"""Server-only Supabase persistence for monthly visitor aggregates."""
import calendar
import re
from datetime import datetime
from uuid import UUID

from .core import ApiError, numeric, observe_source, stamp
from .regions import BY_ID, require_district


def _month(value):
    if not isinstance(value, str) or not re.fullmatch(r'20\d{2}(0[1-9]|1[0-2])', value):
        raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 자료의 기준월을 확인하지 못했습니다.')
    return value


def _integer(value, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 자료의 수집 일수를 확인하지 못했습니다.')
    return value


def _number(value):
    result = numeric(value)
    if result is None or result < 0:
        raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 집계값을 확인하지 못했습니다.')
    return result


def validate_cached_month(value, requested):
    if not isinstance(value, dict) or _month(value.get('ym')) not in requested:
        raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 자료의 범위를 확인하지 못했습니다.')
    ym = value['ym']
    expected = _integer(value.get('expectedDays'), 28, 31)
    if expected != calendar.monthrange(int(ym[:4]), int(ym[4:]))[1]:
        raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 자료의 월별 일수를 확인하지 못했습니다.')
    observed = _integer(value.get('observedDays'), 0, expected)
    complete = value.get('complete')
    if type(complete) is not bool:
        raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 자료의 완전성을 확인하지 못했습니다.')
    through = value.get('through')
    if observed == 0:
        if through is not None:
            raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 자료의 최종 수집일을 확인하지 못했습니다.')
    elif not isinstance(through, str) or not re.fullmatch(ym + r'(0[1-9]|[12]\d|3[01])', through):
        raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 자료의 최종 수집일을 확인하지 못했습니다.')
    numbers = [value.get(key) for key in ('total', 'local', 'outside', 'foreign')]
    if complete:
        if observed != expected:
            raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 자료의 완전성을 확인하지 못했습니다.')
        numbers = [_number(item) for item in numbers]
    elif any(item is not None for item in numbers):
        raise ApiError(503, 'INVALID_STORED_VISITORS', '부분 수집 자료는 월간 합계로 표시할 수 없습니다.')
    fetched = value.get('sourceFetchedAt')
    observe_source(fetched)
    return dict(ym=ym, total=numbers[0], local=numbers[1], outside=numbers[2], foreign=numbers[3],
        complete=complete, observedDays=observed, expectedDays=expected, through=through)


class VisitorMonthStore:
    def __init__(self, database):
        self.db = database

    async def get_many(self, district_id, months):
        district = require_district(district_id)
        requested = {_month(value) for value in months}
        if not requested or len(requested) > 24:
            raise ApiError(400, 'INVALID_MONTHS', '방문자 저장 자료는 한 번에 24개월까지 조회합니다.')
        payload = await self.db.call('POST', '/rest/v1/rpc/visitor_months_get', payload={
            'p_region_id': district['regionId'], 'p_district_id': district['id'],
            'p_months': [value[:4] + '-' + value[4:] + '-01' for value in sorted(requested)],
        }, service=True)
        if not isinstance(payload, list):
            raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 자료의 응답을 확인하지 못했습니다.')
        result = {}
        for item in payload:
            parsed = validate_cached_month(item, requested)
            if parsed['ym'] in result:
                raise ApiError(503, 'INVALID_STORED_VISITORS', '저장된 방문자 자료가 중복되었습니다.')
            result[parsed['ym']] = parsed
        return result

    def rows(self, ym, values, fetched_at=None):
        _month(ym)
        fetched_at = fetched_at or stamp()
        try:
            parsed = datetime.fromisoformat(fetched_at.replace('Z', '+00:00'))
            if parsed.tzinfo is None:
                raise ValueError()
        except (ValueError, TypeError, AttributeError):
            raise ApiError(503, 'INVALID_STORED_VISITORS', '방문자 자료의 수집 시각을 확인하지 못했습니다.') from None
        rows = []
        for district_id, value in values.items():
            if district_id not in BY_ID or not isinstance(value, dict) or value.get('ym') != ym:
                raise ApiError(503, 'INVALID_STORED_VISITORS', '저장할 방문자 자료의 지역을 확인하지 못했습니다.')
            district = BY_ID[district_id]
            rows.append({
                'region_id': district['regionId'], 'district_id': district_id,
                'base_month': ym[:4] + '-' + ym[4:] + '-01',
                'local_visitors': value.get('local'), 'outside_visitors': value.get('outside'),
                'foreign_visitors': value.get('foreign'), 'total_visitors': value.get('total'),
                'complete': value.get('complete'), 'observed_days': value.get('observedDays'),
                'expected_days': value.get('expectedDays'),
                'through_date': (value.get('through')[:4] + '-' + value.get('through')[4:6] + '-' + value.get('through')[6:]) if value.get('through') else None,
                'source_fetched_at': fetched_at,
            })
        return rows

    async def store_month(self, ym, values, fetched_at=None):
        rows = self.rows(ym, values, fetched_at)
        changed = await self.db.call('POST', '/rest/v1/rpc/visitor_months_store', payload={'p_rows': rows}, service=True)
        if isinstance(changed, bool) or not isinstance(changed, int) or not 0 <= changed <= len(rows):
            raise ApiError(503, 'INVALID_STORED_VISITORS', '방문자 자료의 저장 결과를 확인하지 못했습니다.')
        return changed

    async def collection_status(self, months):
        requested = sorted({_month(value) for value in months})
        payload = await self.db.call('POST', '/rest/v1/rpc/visitor_collection_get', payload={
            'p_months': [value[:4] + '-' + value[4:] + '-01' for value in requested],
        }, service=True)
        if not isinstance(payload, list) or len(payload) != len(requested):
            raise ApiError(503, 'INVALID_STORED_VISITORS', '방문자 수집 상태를 확인하지 못했습니다.')
        result = {}
        for item in payload:
            if (not isinstance(item, dict) or _month(item.get('month')) not in requested
                or item.get('state') not in ('missing', 'generating', 'completed', 'failed', 'retryable')):
                raise ApiError(503, 'INVALID_STORED_VISITORS', '방문자 수집 상태를 확인하지 못했습니다.')
            result[item['month']] = item
        return result

    async def claim(self, ym, owner):
        _month(ym); UUID(owner)
        return await self.db.call('POST', '/rest/v1/rpc/visitor_collection_claim', payload={
            'p_month': ym[:4] + '-' + ym[4:] + '-01', 'p_owner_token': owner,
        }, service=True)

    async def finish(self, ym, owner, values, fetched_at=None):
        _month(ym); UUID(owner)
        return await self.db.call('POST', '/rest/v1/rpc/visitor_collection_finish', payload={
            'p_month': ym[:4] + '-' + ym[4:] + '-01', 'p_owner_token': owner,
            'p_rows': self.rows(ym, values, fetched_at),
        }, service=True)

    async def fail(self, ym, owner, code, retry_seconds):
        _month(ym); UUID(owner)
        return await self.db.call('POST', '/rest/v1/rpc/visitor_collection_fail', payload={
            'p_month': ym[:4] + '-' + ym[4:] + '-01', 'p_owner_token': owner,
            'p_error_code': code, 'p_retry_seconds': retry_seconds,
        }, service=True)
