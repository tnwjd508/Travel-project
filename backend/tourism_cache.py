"""Shared Supabase cache for validated Korea Tourism Organization API pages."""
import hashlib
import json
import re
from datetime import datetime, timezone

from .core import ApiError

CACHE_VERSION = 1


def cache_identity(operation, params):
    if not isinstance(operation, str) or not re.fullmatch(r'[A-Za-z0-9]+/[A-Za-z0-9]+', operation):
        raise ApiError(400, 'INVALID_OPERATION', '지원하지 않는 관광 API입니다.')
    if not isinstance(params, dict) or any(not isinstance(key, str) or not isinstance(value, str) for key, value in params.items()):
        raise ApiError(400, 'INVALID_PARAMETER', '관광 API 캐시 조건을 확인하세요.')
    normalized = dict(sorted(params.items()))
    canonical = json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    if len(canonical.encode()) > 4000:
        raise ApiError(400, 'INVALID_PARAMETER', '관광 API 캐시 조건이 너무 깁니다.')
    digest = hashlib.sha256(f'v{CACHE_VERSION}\n{operation}\n{canonical}'.encode()).hexdigest()
    return digest, normalized


def _page(value):
    if not isinstance(value, dict) or set(value) != {'items', 'totalCount'}:
        raise ApiError(503, 'INVALID_STORED_TOURISM', '저장된 관광 API 응답 형식을 확인하지 못했습니다.')
    items, total = value['items'], value['totalCount']
    if not isinstance(items, list) or len(items) > 1000 or any(not isinstance(item, dict) for item in items):
        raise ApiError(503, 'INVALID_STORED_TOURISM', '저장된 관광 API 항목을 확인하지 못했습니다.')
    if isinstance(total, bool) or not isinstance(total, int) or total < len(items):
        raise ApiError(503, 'INVALID_STORED_TOURISM', '저장된 관광 API 전체 건수를 확인하지 못했습니다.')
    return items, total


def _timestamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            raise ValueError()
        return parsed.astimezone(timezone.utc)
    except (ValueError, TypeError, AttributeError):
        raise ApiError(503, 'INVALID_STORED_TOURISM', '저장된 관광 API 수집 시각을 확인하지 못했습니다.') from None


class TourismApiStore:
    def __init__(self, database):
        self.db = database

    async def get(self, operation, params):
        digest, normalized = cache_identity(operation, params)
        value = await self.db.call('POST', '/rest/v1/rpc/tourism_cache_get', payload={
            'p_request_sha256': digest, 'p_operation': operation,
            'p_request_params': normalized, 'p_schema_version': CACHE_VERSION,
        }, service=True)
        if not isinstance(value, dict) or value.get('state') not in ('missing', 'stored'):
            raise ApiError(503, 'INVALID_STORED_TOURISM', '저장된 관광 API 상태를 확인하지 못했습니다.')
        if value['state'] == 'missing':
            return None
        if set(value) != {'state', 'payload', 'fetchedAt'}:
            raise ApiError(503, 'INVALID_STORED_TOURISM', '저장된 관광 API 응답을 확인하지 못했습니다.')
        items, total = _page(value['payload'])
        fetched = _timestamp(value['fetchedAt'])
        return dict(items=items, total=total, fetchedAt=fetched.isoformat().replace('+00:00', 'Z'),
            age=max(0, (datetime.now(timezone.utc) - fetched).total_seconds()))

    async def store(self, operation, params, items, total, fetched_at):
        digest, normalized = cache_identity(operation, params)
        payload = {'items': items, 'totalCount': total}
        _page(payload); _timestamp(fetched_at)
        value = await self.db.call('POST', '/rest/v1/rpc/tourism_cache_store', payload={
            'p_request_sha256': digest, 'p_operation': operation, 'p_request_params': normalized,
            'p_response_payload': payload, 'p_source_fetched_at': fetched_at,
            'p_schema_version': CACHE_VERSION,
        }, service=True)
        if not isinstance(value, dict) or value.get('state') != 'stored':
            raise ApiError(503, 'INVALID_STORED_TOURISM', '관광 API 캐시 저장 결과를 확인하지 못했습니다.')
