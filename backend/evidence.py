"""Versioned historical evidence. The database is authoritative; no bundled fallback."""
import math
import re
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Request

from .core import ApiError
from .regions import require_district
from .scenarios import POLICIES
from .supabase import SupabaseDatabase, checked_query, json_response, parse_uuid

SEGMENTS = ('all', 'short', 'long', 'night', 'metroGu', 'placebo')
OUTCOMES = ('outside', 'total')
RULE_VERSION = 'festival-reference-v2'
RELEASE_COLUMNS = 'id,artifact_schema_version,artifact_sha256,repository_commit,generated_at,provenance_revision,provenance_status,artifact_payload'
STAT_COLUMNS = 'id,release_id,outcome,segment,sample_count,mean_pct,median_pct,ci_lower_pct,ci_upper_pct,share_positive,interval_level,estimate_kind'


def timestamp(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})', value):
        raise ValueError('Invalid timestamp')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Missing timezone')
    return parsed


def finite(value, minimum=None, maximum=None):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('Non-finite numeric value')
    if minimum is not None and value < minimum or maximum is not None and value > maximum:
        raise ValueError('Numeric value outside contract')
    return value


def integer(value, minimum=0):
    if type(value) is not int or value < minimum:
        raise ValueError('Invalid integer')
    return value


def ymd(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{8}', value):
        raise ValueError('Invalid date')
    return datetime.strptime(value, '%Y%m%d').date()


def validate_artifact(payload):
    if not isinstance(payload, dict) or type(payload.get('version')) is not int or payload['version'] != 1:
        raise ValueError('Unsupported artifact schema')
    timestamp(payload['generatedAt'])
    if not all(isinstance(payload[key], str) and payload[key].strip() for key in ('method', 'outcome')):
        raise ValueError('Missing method')
    data = payload['data']
    if ymd(data['visitorsFrom']) > ymd(data['visitorsTo']):
        raise ValueError('Invalid coverage')
    integer(data['festivalsUsed'])
    if integer(data['maxDays'], 1) != 7:
        raise ValueError('Unsupported festival duration')
    starts = data['festivalStart']
    if not ymd(starts['first']) <= ymd(starts['median']) <= ymd(starts['last']):
        raise ValueError('Invalid festival coverage')
    if not isinstance(data['sources'], list) or not data['sources'] or not all(isinstance(s, str) and s for s in data['sources']):
        raise ValueError('Missing sources')
    for outcome in OUTCOMES:
        for segment in SEGMENTS:
            stat = payload[outcome][segment]
            if stat is None:
                continue
            integer(stat['n'], 1)
            finite(stat['meanPct'], -100); finite(stat['medianPct'], -100)
            ci = stat['ci95Pct']
            if not isinstance(ci, list) or len(ci) != 2 or finite(ci[0], -100) > finite(ci[1], -100):
                raise ValueError('Invalid interval')
            finite(stat['sharePositive'], 0, 1)
    if not isinstance(payload['gwangju'], list):
        raise ValueError('Invalid local cases')
    for case in payload['gwangju']:
        if not re.fullmatch(r'\d{5}', case['code']) or not all(isinstance(case[k], str) and case[k] for k in ('title', 'district', 'source')):
            raise ValueError('Invalid local case')
        ymd(case['start']); finite(case['effectPct'], -100)
        if integer(case['days'], 1) > 7:
            raise ValueError('Invalid local case duration')
    return payload


def selection(policy, district_id):
    if policy not in POLICIES:
        raise ApiError(400, 'INVALID_POLICY', '지원하는 정책을 선택하세요.')
    district = require_district(district_id)
    code = district['id']
    if policy == 'festival':
        eligible = code in ('12210', '12240', '12270', '12300', '12330') or code.startswith('11') or (
            code[:2] in ('26', '27', '28', '30', '31') and int(code[2:]) < 700)
        return district, 'metroGu' if eligible else None, None if eligible else 'out_of_scope'
    if policy == 'night':
        return district, 'night', None
    return district, None, 'unsupported_policy'


def empty_reference(policy, district, status, rule=RULE_VERSION):
    return dict(policy=policy, districtId=district['id'], regionId=district['regionId'], status=status,
        releaseId=None, statisticId=None, stat=None, basis='', metadata=None, selectionRuleVersion=rule)


class EvidenceService:
    def __init__(self, database):
        self.db = database

    async def release(self, identifier=None):
        params = {'select': RELEASE_COLUMNS, 'order': 'generated_at.desc,provenance_revision.desc,id.desc', 'limit': '1'}
        if identifier:
            params['id'] = 'eq.' + parse_uuid(identifier)
        rows = await self.db.rows('policy_evidence_releases', params=params, service=True)
        if not rows:
            if identifier:
                raise ApiError(404, 'EVIDENCE_NOT_FOUND', '선택한 분석 자료를 찾을 수 없습니다.')
            return None
        release = rows[0]
        try:
            UUID(release['id']); validate_artifact(release['artifact_payload'])
            if release['provenance_status'] not in ('partial', 'complete'):
                raise ValueError()
        except (ValueError, TypeError, KeyError, AttributeError):
            raise ApiError(503, 'INVALID_STORED_EVIDENCE', '저장된 분석 자료를 확인하지 못했습니다.') from None
        return release

    def present(self, policy, district, release, row, *, rule=RULE_VERSION):
        try:
            UUID(row['id'])
            if row['release_id'] != release['id'] or row['outcome'] != 'outside' or row['estimate_kind'] != 'historical_adjusted_change' or float(row['interval_level']) != 0.95:
                raise ValueError()
            segment = 'metroGu' if policy == 'festival' else 'night' if policy == 'night' else None
            if row['segment'] != segment:
                raise ValueError()
            original = release['artifact_payload']['outside'][segment]
            stat = None
            if original is not None:
                stat = dict(n=integer(row['sample_count'], 1), meanPct=float(row['mean_pct']), medianPct=float(row['median_pct']),
                    ci95Pct=[float(row['ci_lower_pct']), float(row['ci_upper_pct'])], sharePositive=float(row['share_positive']))
                if stat != original:
                    raise ValueError()
            elif row['sample_count'] != 0 or any(row[key] is not None for key in ('mean_pct', 'median_pct', 'ci_lower_pct', 'ci_upper_pct', 'share_positive')):
                raise ValueError()
        except (ValueError, TypeError, KeyError, AttributeError):
            raise ApiError(503, 'INVALID_STORED_EVIDENCE', '저장된 분석 자료를 확인하지 못했습니다.') from None
        status = 'available' if stat and stat['ci95Pct'][0] > 0 else 'insufficient_evidence'
        artifact = release['artifact_payload']
        count = stat['n'] if stat else 0
        return dict(policy=policy, districtId=district['id'], regionId=district['regionId'], status=status,
            releaseId=release['id'], statisticId=row['id'], stat=stat,
            basis=f'전국 특별·광역시 자치구 축제 {count}건' if segment == 'metroGu' else f'야간 키워드 축제 {count}건',
            metadata=dict(generatedAt=artifact['generatedAt'], visitorsFrom=ymd(artifact['data']['visitorsFrom']).isoformat(),
                visitorsTo=ymd(artifact['data']['visitorsTo']).isoformat(), method=artifact['method'],
                sources=artifact['data']['sources'], provenanceStatus=release['provenance_status']), selectionRuleVersion=rule)

    async def reference(self, policy, district_id, release_id=None):
        district, segment, unavailable = selection(policy, district_id)
        if unavailable:
            return empty_reference(policy, district, unavailable)
        release = await self.release(release_id)
        if release is None:
            return empty_reference(policy, district, 'not_imported')
        rows = await self.db.rows('policy_evidence_statistics', params={'select': STAT_COLUMNS,
            'release_id': 'eq.' + release['id'], 'outcome': 'eq.outside', 'segment': 'eq.' + segment}, service=True)
        if len(rows) != 1:
            raise ApiError(503, 'INVALID_STORED_EVIDENCE', '저장된 분석 자료를 확인하지 못했습니다.')
        return self.present(policy, district, release, rows[0])

    async def saved_reference(self, scenario, review):
        district = require_district(scenario['district_id'], scenario['region_id'])
        identifier = review['evidence_statistic_id']
        if not identifier:
            return empty_reference(scenario['policy_code'], district, review['reference_status'], review['selection_rule_version'])
        rows = await self.db.rows('policy_evidence_statistics', params={'select': STAT_COLUMNS, 'id': 'eq.' + parse_uuid(identifier)}, service=True)
        if len(rows) != 1:
            raise ApiError(503, 'INVALID_STORED_EVIDENCE', '저장된 분석 자료를 확인하지 못했습니다.')
        release = await self.release(rows[0]['release_id'])
        result = self.present(scenario['policy_code'], district, release, rows[0], rule=review['selection_rule_version'])
        if result['status'] != review['reference_status']:
            raise ApiError(503, 'INVALID_STORED_EVIDENCE', '저장된 분석 자료를 확인하지 못했습니다.')
        return result

    async def collection(self, district_id, release_id=None):
        district = require_district(district_id)
        release = await self.release(release_id)
        rows = await self.db.rows('policy_evidence_statistics', params={'select': STAT_COLUMNS,
            'release_id': 'eq.' + release['id'], 'outcome': 'eq.outside'}, service=True) if release else []
        items = []
        for policy in POLICIES:
            _, segment, unavailable = selection(policy, district_id)
            if unavailable or release is None:
                items.append(empty_reference(policy, district, unavailable or 'not_imported'))
                continue
            matches = [row for row in rows if row.get('segment') == segment]
            if len(matches) != 1:
                raise ApiError(503, 'INVALID_STORED_EVIDENCE', '저장된 분석 자료를 확인하지 못했습니다.')
            items.append(self.present(policy, district, release, matches[0]))
        return dict(districtId=district['id'], regionId=district['regionId'],
            releaseId=release['id'] if release else None, items=items)


def evidence_router(env):
    router = APIRouter(tags=['과거 정책 근거'])

    @router.get('/api/policy-evidence')
    async def get_evidence(request: Request):
        query = checked_query(request, {'policy', 'district', 'regionId', 'releaseId'})
        district = require_district(query.get('district', ''), query.get('regionId'))
        release_id = parse_uuid(query['releaseId']) if query.get('releaseId') else None
        service = EvidenceService(SupabaseDatabase(env, request.app.state.http))
        return json_response(await service.reference(query['policy'], district['id'], release_id)
            if 'policy' in query else await service.collection(district['id'], release_id))

    return router
