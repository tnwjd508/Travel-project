"""Supabase Auth + organization-owned scenario storage. Never accepts result values."""
import hashlib
import json
import re
from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field, StrictInt

from .core import ApiError
from .supabase import SupabaseDatabase, json_response, parse_uuid
from .regions import CATALOGUE, require_district

POLICIES = {'night': '야간관광 확대', 'festival': '문화축제 개최', 'shuttle': '관광 셔틀 운영', 'market': '로컬마켓 연계', 'art': '문화예술 프로그램'}
PUBLIC_COLUMNS = 'id,organization_id,created_by,title,region_id,district_id,district_name,policy_code,policy_name,budget_krw,start_month,duration_months,briefing_month,created_at'


class ScenarioInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    organizationId: UUID
    regionId: str = Field(min_length=1, max_length=50)
    district: str = Field(min_length=1, max_length=30)
    policy: str
    budgetKrw: StrictInt = Field(ge=500_000_000, le=5_000_000_000)
    startMonth: str
    durationMonths: StrictInt
    briefingMonth: str | None = None


def month(value):
    if not isinstance(value, str) or not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])', value):
        raise ApiError(400, 'INVALID_MONTH', '월은 YYYY-MM 형식으로 입력하세요.')
    return date.fromisoformat(value + '-01').isoformat()


def scenario_router(env):
    router = APIRouter(tags=['기관 시나리오'])

    def db(request):
        return SupabaseDatabase(env, request.app.state.http)

    @router.get('/api/account/config')
    async def config(request: Request):
        return json_response(db(request).config())

    @router.get('/api/account/organizations')
    async def organizations(request: Request):
        database = db(request)
        user_id, token = await database.user(request)
        rows = await database.call('GET', '/rest/v1/organization_members', token, params={
            'select': 'organization_id,role,organizations(id,name)', 'user_id': 'eq.' + user_id, 'order': 'created_at.asc',
        })
        return json_response({'organizations': [dict(id=row['organization_id'], role=row['role'], name=row['organizations']['name']) for row in rows]})

    @router.post('/api/scenarios')
    async def save(request: Request, body: ScenarioInput):
        database = db(request)
        user_id, token = await database.user(request)
        org_id = str(body.organizationId)
        if await database.member(token, user_id, org_id) not in ('admin', 'editor'):
            raise ApiError(403, 'FORBIDDEN', '조회 전용 계정은 시나리오를 저장할 수 없습니다.')
        key = parse_uuid(request.headers.get('idempotency-key', ''))
        district = require_district(body.district, body.regionId)
        if body.policy not in POLICIES or body.durationMonths not in (3, 6, 12) or body.budgetKrw % 100_000_000:
            raise ApiError(400, 'INVALID_PARAMETER', '정책·예산·기간을 확인하세요.')
        canonical = dict(organization_id=org_id, user_id=user_id, region_id=district['regionId'], district_id=district['id'],
            policy_code=body.policy, budget_krw=body.budgetKrw, start_month=month(body.startMonth),
            duration_months=body.durationMonths, briefing_month=month(body.briefingMonth) if body.briefingMonth else None)
        digest = hashlib.sha256(json.dumps(canonical, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
        args = {f'p_{key}': value for key, value in canonical.items()}
        args.update(p_idempotency_key=key, p_request_sha256=digest, p_district_name=district['name'],
            p_catalogue_version=CATALOGUE['updatedAt'], p_policy_name=POLICIES[body.policy])
        row = await database.call('POST', '/rest/v1/rpc/scenario_save', token, payload=args, service=True)
        return json_response({key: row[key] for key in PUBLIC_COLUMNS.split(',')})

    @router.get('/api/scenarios')
    async def list_scenarios(request: Request):
        pairs = list(request.query_params.multi_items())
        query = dict(pairs)
        if len(pairs) != len(query) or set(query) - {'organizationId', 'district', 'cursor'}:
            raise ApiError(400, 'INVALID_PARAMETER', '조회 조건을 확인하세요.')
        org_id = parse_uuid(query.get('organizationId'))
        database = db(request)
        user_id, token = await database.user(request)
        await database.member(token, user_id, org_id)
        params = {'select': PUBLIC_COLUMNS, 'organization_id': 'eq.' + org_id, 'order': 'created_at.desc,id.desc', 'limit': '21'}
        if query.get('district'):
            params['district_id'] = 'eq.' + require_district(query['district'])['id']
        if query.get('cursor'):
            try:
                timestamp, identifier = query['cursor'].split('|')
                stamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                if stamp.tzinfo is None:
                    raise ValueError()
                timestamp, identifier = stamp.isoformat(), str(UUID(identifier))
            except (ValueError, TypeError):
                raise ApiError(400, 'INVALID_PARAMETER', '목록 페이지를 다시 조회하세요.') from None
            params['or'] = f'(created_at.lt.{timestamp},and(created_at.eq.{timestamp},id.lt.{identifier}))'
        rows = await database.call('GET', '/rest/v1/simulation_scenarios', token, params=params)
        items = rows[:20]
        cursor = items[-1]['created_at'] + '|' + items[-1]['id'] if len(rows) > 20 else None
        return json_response({'items': items, 'nextCursor': cursor})

    @router.get('/api/scenarios/{scenario_id}')
    async def get_scenario(request: Request, scenario_id: str):
        identifier = parse_uuid(scenario_id)
        org_id = parse_uuid(request.query_params.get('organizationId'))
        database = db(request)
        user_id, token = await database.user(request)
        await database.member(token, user_id, org_id)
        rows = await database.call('GET', '/rest/v1/simulation_scenarios', token, params={
            'select': PUBLIC_COLUMNS, 'id': 'eq.' + identifier, 'organization_id': 'eq.' + org_id,
        })
        if not rows:
            raise ApiError(404, 'NOT_FOUND', '저장한 시나리오를 찾을 수 없습니다.')
        return json_response(rows[0])

    return router
