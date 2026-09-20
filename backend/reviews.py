"""Organization-scoped immutable reviews; baseline values are collected on the server."""
import asyncio
import hashlib
import json
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field

from .baseline import capture_baseline, validate_response
from .core import ApiError
from .evidence import EvidenceService, RULE_VERSION, timestamp
from .scenarios import PUBLIC_COLUMNS as SCENARIO_COLUMNS
from .supabase import SupabaseDatabase, checked_query, cursor_filter, json_response, parse_uuid

REVIEW_COLUMNS = 'id,organization_id,scenario_id,created_by,evidence_statistic_id,reference_status,review_kind,selection_rule_version,baseline_schema_version,baseline_status,baseline_snapshot,created_at'
LIST_COLUMNS = 'id,organization_id,scenario_id,created_by,reference_status,baseline_status,selection_rule_version,created_at'


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    organizationId: UUID
    releaseId: UUID | None = None
    baseYm: str | None = Field(default=None, pattern=r'^20\d{2}(0[1-9]|1[0-2])$')
    visitorYm: str | None = Field(default=None, pattern=r'^20\d{2}(0[1-9]|1[0-2])$')


async def review_contract(database):
    result = await database.call('POST', '/rest/v1/rpc/review_contract', payload={}, service=True)
    if result != {'rule_version': RULE_VERSION, 'baseline_schema_version': 1}:
        raise ApiError(503, 'DB_SCHEMA_NOT_READY', '검토 저장 서비스 준비 상태를 확인해 주세요.')


class ReviewService:
    def __init__(self, db):
        self.db = db
        self.evidence = EvidenceService(db)

    async def scenario(self, token, org_id, identifier):
        rows = await self.db.rows('simulation_scenarios', token, params={'select': SCENARIO_COLUMNS,
            'organization_id': 'eq.' + org_id, 'id': 'eq.' + identifier})
        if len(rows) != 1:
            raise ApiError(404, 'NOT_FOUND', '저장한 시나리오를 찾을 수 없습니다.')
        row = rows[0]
        if row['organization_id'] != org_id or row['id'] != identifier:
            raise ApiError(503, 'INVALID_STORED_REVIEW', '저장된 조건을 확인하지 못했습니다.')
        return row

    async def detail(self, token, org_id, row, scenario=None):
        if row['organization_id'] != org_id:
            raise ApiError(404, 'NOT_FOUND', '저장된 검토를 찾을 수 없습니다.')
        scenario = scenario or await self.scenario(token, org_id, parse_uuid(row['scenario_id']))
        try:
            if scenario['id'] != row['scenario_id'] or row['review_kind'] != 'historical_reference' or row['baseline_schema_version'] != 1:
                raise ValueError()
            baseline = row['baseline_snapshot']
            timestamp(baseline['capturedAt'])
            requested = baseline['request']
            if requested['districtId'] != scenario['district_id'] or requested['regionId'] != scenario['region_id']:
                raise ValueError()
            count = 0
            for resource in ('summary', 'diagnosis'):
                if baseline[resource] is not None:
                    validate_response(resource, baseline[resource], {'district': scenario['district_id'],
                        'baseYm': requested['indexMonth'], 'visitorYm': requested['visitorMonth']})
                    count += 1
            if row['baseline_status'] not in ('complete', 'partial', 'unavailable') or (row['baseline_status'] == 'unavailable') != (count == 0) or row['baseline_status'] == 'complete' and count != 2:
                raise ValueError()
        except (ValueError, TypeError, KeyError, AttributeError):
            raise ApiError(503, 'INVALID_STORED_REVIEW', '저장된 검토를 확인하지 못했습니다.') from None
        evidence = await self.evidence.saved_reference(scenario, row)
        return dict(review={key: row[key] for key in REVIEW_COLUMNS.split(',')}, scenario=scenario, evidence=evidence)


def review_router(env):
    router = APIRouter(tags=['기관 검토 기록'])

    async def authenticated(request, org_id):
        database = SupabaseDatabase(env, request.app.state.http)
        user_id, token = await database.user(request)
        role = await database.member(token, user_id, org_id)
        return database, user_id, token, role

    async def save(request, identifier, body):
        checked_query(request, set())
        org_id = str(body.organizationId)
        database, user_id, token, role = await authenticated(request, org_id)
        if role not in ('admin', 'editor'):
            raise ApiError(403, 'FORBIDDEN', '조회 전용 계정은 검토를 저장할 수 없습니다.')
        key = parse_uuid(request.headers.get('idempotency-key', ''))
        service = ReviewService(database)
        scenario = await service.scenario(token, org_id, identifier)
        release_id = str(body.releaseId) if body.releaseId else None
        canonical = dict(user=user_id, organization=org_id, scenario=identifier, release=release_id,
            baseYm=body.baseYm, visitorYm=body.visitorYm)
        digest = hashlib.sha256(json.dumps(canonical, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        existing = await database.rows('scenario_reviews', token, params={'select': REVIEW_COLUMNS + ',request_sha256',
            'organization_id': 'eq.' + org_id, 'idempotency_key': 'eq.' + key, 'limit': '1'})
        if existing:
            if existing[0]['request_sha256'] != digest or existing[0]['scenario_id'] != identifier:
                raise ApiError(409, 'IDEMPOTENCY_CONFLICT', '같은 요청 번호에 다른 검토 조건이 있습니다.')
            return await service.detail(token, org_id, existing[0], scenario)
        # Fail before collecting external data if the deployed DB uses an old contract.
        await review_contract(database)
        reference = await service.evidence.reference(scenario['policy_code'], scenario['district_id'], release_id)
        state, snapshot = await capture_baseline(request.app.state.service, env, scenario, body.baseYm, body.visitorYm)
        row = await database.call('POST', '/rest/v1/rpc/save_scenario_review', token, service=True, payload={
            'p_organization_id': org_id, 'p_scenario_id': identifier, 'p_user_id': user_id, 'p_idempotency_key': key,
            'p_request_sha256': digest, 'p_baseline_status': state, 'p_baseline_snapshot': snapshot,
            'p_evidence_release_id': reference['releaseId'],
        })
        # The RPC may return the earlier winner of a concurrent request. Read its pinned evidence.
        return await service.detail(token, org_id, row, scenario)

    @router.post('/api/scenarios/{scenario_id}/reviews')
    async def create_review(request: Request, scenario_id: str, body: ReviewInput):
        try:
            async with asyncio.timeout(55):
                return json_response(await save(request, parse_uuid(scenario_id), body))
        except TimeoutError:
            raise ApiError(504, 'REVIEW_TIMEOUT', '저장 상태를 확인하지 못했습니다. 같은 요청으로 다시 시도하세요.') from None

    @router.get('/api/scenarios/{scenario_id}/reviews')
    async def list_reviews(request: Request, scenario_id: str):
        query = checked_query(request, {'organizationId', 'cursor'})
        org_id, identifier = parse_uuid(query.get('organizationId')), parse_uuid(scenario_id)
        database, _, token, _ = await authenticated(request, org_id)
        await ReviewService(database).scenario(token, org_id, identifier)
        params = {'select': LIST_COLUMNS, 'organization_id': 'eq.' + org_id, 'scenario_id': 'eq.' + identifier,
            'order': 'created_at.desc,id.desc', 'limit': '21'}
        if query.get('cursor'):
            params['or'] = cursor_filter(query['cursor'])
        rows = await database.rows('scenario_reviews', token, params=params)
        items = rows[:20]
        return json_response(dict(items=items, nextCursor=items[-1]['created_at'] + '|' + items[-1]['id'] if len(rows) > 20 else None))

    @router.get('/api/scenario-reviews/{review_id}')
    async def get_review(request: Request, review_id: str):
        query = checked_query(request, {'organizationId'})
        org_id = parse_uuid(query.get('organizationId'))
        database, _, token, _ = await authenticated(request, org_id)
        rows = await database.rows('scenario_reviews', token, params={'select': REVIEW_COLUMNS,
            'organization_id': 'eq.' + org_id, 'id': 'eq.' + parse_uuid(review_id)})
        if len(rows) != 1:
            raise ApiError(404, 'NOT_FOUND', '저장된 검토를 찾을 수 없습니다.')
        return json_response(await ReviewService(database).detail(token, org_id, rows[0]))

    return router
