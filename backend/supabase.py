"""Shared authenticated Supabase transport. No credentials in public responses."""
import re
from datetime import datetime
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from fastapi.responses import JSONResponse
from .core import ApiError


def parse_uuid(value):
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise ApiError(400, 'INVALID_PARAMETER', '저장 식별자를 확인하세요.') from None


def json_response(value, status=200):
    return JSONResponse(value, status_code=status, headers={'Cache-Control': 'no-store'})


def checked_query(request, allowed):
    pairs = list(request.query_params.multi_items())
    if len(pairs) != len(dict(pairs)) or set(dict(pairs)) - set(allowed):
        raise ApiError(400, 'INVALID_PARAMETER', '조회 조건을 확인하세요.')
    return dict(pairs)


def cursor_filter(value):
    try:
        timestamp, identifier = value.split('|')
        parsed = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            raise ValueError()
        timestamp, identifier = parsed.isoformat(), str(UUID(identifier))
        return f'(created_at.lt.{timestamp},and(created_at.eq.{timestamp},id.lt.{identifier}))'
    except (ValueError, TypeError):
        raise ApiError(400, 'INVALID_PARAMETER', '목록 페이지를 다시 조회하세요.') from None


class SupabaseDatabase:
    def __init__(self, env, http):
        self.env, self.http = env, http

    def base_url(self):
        url = self.env.get('SUPABASE_URL', '').strip().rstrip('/')
        try:
            parts = urlsplit(url)
        except ValueError:
            raise ApiError(503, 'DB_NOT_CONFIGURED', '공동 저장 서비스 설정을 확인하세요.') from None
        if not url or parts.username or parts.password or parts.query or parts.fragment or parts.path or not parts.hostname:
            raise ApiError(503, 'DB_NOT_CONFIGURED', '공동 저장 서비스가 설정되지 않았습니다.')
        if parts.scheme != 'https' and not (parts.scheme == 'http' and parts.hostname in ('localhost', '127.0.0.1')):
            raise ApiError(503, 'DB_NOT_CONFIGURED', '공동 저장 서비스 설정을 확인하세요.')
        return url

    def config(self):
        url = self.base_url()
        key = self.env.get('SUPABASE_PUBLISHABLE_KEY', '').strip()
        # Expose only a modern publishable key. Never return a secret/service key.
        if not key.startswith('sb_publishable_'):
            raise ApiError(503, 'DB_NOT_CONFIGURED', '공동 저장용 공개 인증키를 설정해 주세요.')
        return {'url': url, 'publishableKey': key}

    def headers(self, token='', *, service=False):
        key = ''
        if service:
            key = (self.env.get('SUPABASE_SECRET_KEY') or self.env.get('SUPABASE_SERVICE_ROLE_KEY') or '').strip()
            if not key:
                raise ApiError(503, 'DB_NOT_CONFIGURED', '공동 저장용 서버 인증키를 설정해 주세요.')
        else:
            key = self.config()['publishableKey']
        headers = {'apikey': key, 'Accept': 'application/json'}
        if not service:
            headers['Authorization'] = token
        elif not key.startswith('sb_secret_'):
            headers['Authorization'] = 'Bearer ' + key
        return headers

    async def call(self, method, path, token='', *, params=None, payload=None, service=False):
        headers = self.headers(token, service=service)
        try:
            result = await self.http.request(method, self.base_url() + path, headers=headers, params=params, json=payload, timeout=12, follow_redirects=False)
        except httpx.HTTPError:
            raise ApiError(503, 'DB_UNAVAILABLE', '저장 서버에 연결하지 못했습니다. 같은 요청으로 다시 시도하세요.') from None
        if result.status_code in (401, 403) and not service:
            raise ApiError(401, 'AUTH_REQUIRED', '로그인이 만료되었습니다. 다시 로그인하세요.')
        if not result.is_success:
            try:
                details = result.json()
                code = details.get('code')
                message = details.get('message', '')
            except (ValueError, AttributeError):
                code, message = None, ''
            if code in ('42P01', '42883', 'PGRST202', 'PGRST205'):
                raise ApiError(503, 'DB_SCHEMA_NOT_READY', '저장 서비스 준비 상태를 확인해 주세요.')
            if message == 'ARTIFACT_HASH_CONFLICT':
                raise ApiError(409, 'IMPORT_CONFLICT', '같은 분석 자료 버전의 등록 정보가 다릅니다.')
            if message == 'EVIDENCE_RELEASE_NOT_FOUND':
                raise ApiError(409, 'EVIDENCE_NOT_FOUND', '선택한 분석 자료를 찾을 수 없습니다.')
            if code == '42501':
                raise ApiError(403, 'FORBIDDEN', '이 기관에 저장할 권한이 없습니다.')
            if code == '23505':
                raise ApiError(409, 'IDEMPOTENCY_CONFLICT', '같은 요청 번호에 다른 저장 조건이 있습니다. 새 저장을 시작하세요.')
            if code == '23503':
                raise ApiError(409, 'BRIEFING_NOT_FOUND', '선택한 지역·월의 저장된 브리핑이 없습니다. 브리핑을 먼저 확인하거나 연결 없이 저장하세요.')
            raise ApiError(503, 'DB_UNAVAILABLE', '저장 서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도하세요.')
        try:
            return result.json()
        except ValueError:
            raise ApiError(503, 'DB_UNAVAILABLE', '저장 서버 응답을 확인하지 못했습니다.') from None

    async def user(self, request):
        token = request.headers.get('authorization', '')
        if not re.fullmatch(r'Bearer [A-Za-z0-9._~-]{1,8192}', token):
            raise ApiError(401, 'AUTH_REQUIRED', '기관 계정으로 로그인하세요.')
        data = await self.call('GET', '/auth/v1/user', token)
        # Remote Auth verifies the token; decoded browser claims are not trusted.
        if not isinstance(data, dict) or not data.get('id'):
            raise ApiError(401, 'AUTH_REQUIRED', '사용자 인증을 확인하지 못했습니다.')
        return parse_uuid(data['id']), token

    async def member(self, token, user_id, org_id):
        rows = await self.call('GET', '/rest/v1/organization_members', token, params={
            'select': 'role', 'organization_id': 'eq.' + org_id, 'user_id': 'eq.' + user_id,
        })
        if not rows:
            raise ApiError(403, 'FORBIDDEN', '현재 소속된 기관의 기록만 조회할 수 있습니다.')
        return rows[0]['role']

    async def rows(self, table, token='', *, params=None, service=False):
        data = await self.call('GET', '/rest/v1/' + table, token, params=params, service=service)
        if not isinstance(data, list) or any(not isinstance(row, dict) for row in data):
            raise ApiError(503, 'DB_UNAVAILABLE', '저장 서버 응답을 확인하지 못했습니다.')
        return data


