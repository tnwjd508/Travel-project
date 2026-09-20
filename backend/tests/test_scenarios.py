import json

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app import create_app

USER = '00000000-0000-4000-8000-000000000001'
ORG = '00000000-0000-4000-8000-000000000011'
KEY = '00000000-0000-4000-8000-000000000021'
ENV = {'SUPABASE_URL': 'https://database.example', 'SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_test', 'SUPABASE_SECRET_KEY': 'sb_secret_never_expose'}
HEADERS = {'Authorization': 'Bearer verified-user-token', 'Idempotency-Key': KEY}
INPUT = dict(organizationId=ORG, regionId='gwangju', district='donggu', policy='night', budgetKrw=1500000000, startMonth='2026-10', durationMonths=12)


def upstream(request):
    assert request.url.host == 'database.example'
    if request.url.path == '/auth/v1/user':
        assert request.headers['authorization'] == HEADERS['Authorization']
        return httpx.Response(200, json={'id': USER})
    if request.url.path == '/rest/v1/organization_members':
        assert request.headers['apikey'] == 'sb_publishable_test'
        assert request.url.params['user_id'] == 'eq.' + USER
        return httpx.Response(200, json=[{'role': 'editor', 'organization_id': ORG, 'organizations': {'name': '기관 A'}}])
    if request.url.path == '/rest/v1/rpc/scenario_save':
        assert request.headers['apikey'] == ENV['SUPABASE_SECRET_KEY']
        assert 'authorization' not in request.headers
        args = json.loads(request.content)
        assert args['p_user_id'] == USER and args['p_organization_id'] == ORG
        assert args['p_region_id'] == 'jeonnam-gwangju' and args['p_district_id'] == '12210'
        assert args['p_start_month'] == '2026-10-01' and args['p_budget_krw'] == 1500000000
        assert len(args['p_request_sha256']) == 64 and args['p_idempotency_key'] == KEY
        return httpx.Response(200, json=dict(id=KEY, organization_id=ORG, created_by=USER, title='저장된 조건',
            region_id=args['p_region_id'], district_id=args['p_district_id'], district_name=args['p_district_name'],
            policy_code=args['p_policy_code'], policy_name=args['p_policy_name'], budget_krw=args['p_budget_krw'],
            start_month=args['p_start_month'], duration_months=args['p_duration_months'], briefing_month=None,
            created_at='2026-09-19T00:00:00+00:00', request_sha256=args['p_request_sha256']))
    if request.url.path == '/rest/v1/simulation_scenarios':
        assert request.headers['authorization'] == HEADERS['Authorization']
        assert request.headers['apikey'] == 'sb_publishable_test'
        assert request.url.params['organization_id'] == 'eq.' + ORG
        return httpx.Response(200, json=[])
    raise AssertionError(request.url.path)


def test_config_login_and_real_save_contract():
    with TestClient(create_app(ENV, httpx.MockTransport(upstream))) as client:
        config = client.get('/api/account/config')
        assert config.json() == {'url': ENV['SUPABASE_URL'], 'publishableKey': 'sb_publishable_test'}
        assert 'secret' not in config.text
        assert client.post('/api/scenarios', json=INPUT).status_code == 401
        assert client.get('/api/account/organizations', headers=HEADERS).json()['organizations'][0]['id'] == ORG
        result = client.post('/api/scenarios', headers=HEADERS, json=INPUT)
        assert result.status_code == 200 and result.json()['duration_months'] == 12
        assert 'request_sha256' not in result.text and 'secret' not in result.text
        assert result.headers['cache-control'] == 'no-store'
        assert client.get('/api/scenarios', params={'organizationId': ORG, 'district': 'donggu'}, headers=HEADERS).json() == {'items': [], 'nextCursor': None}
        assert client.get('/api/scenarios/' + KEY, params={'organizationId': ORG}, headers=HEADERS).status_code == 404
        invalid_method = client.delete('/api/scenarios', headers=HEADERS)
        assert invalid_method.status_code == 405 and invalid_method.headers['allow'] == 'GET, POST'


@pytest.mark.parametrize('patch', [dict(created_by=USER), dict(result={'visitorChange': 15}), dict(budgetKrw=True),
    dict(budgetKrw=1500000001), dict(durationMonths=4), dict(startMonth='2026-13'), dict(regionId='seoul'), dict(policy='unknown')])
def test_rejects_spoofed_or_invalid_inputs(patch):
    with TestClient(create_app(ENV, httpx.MockTransport(upstream))) as client:
        assert client.post('/api/scenarios', json=INPUT | patch, headers=HEADERS).status_code == 400


@pytest.mark.parametrize('role', ['viewer', None])
def test_permission_failure_never_calls_save(role):
    def transport(request):
        if request.url.path.endswith('organization_members'):
            return httpx.Response(200, json=[{'role': role}] if role else [])
        assert not request.url.path.endswith('scenario_save')
        return upstream(request)
    with TestClient(create_app(ENV, httpx.MockTransport(transport))) as client:
        assert client.post('/api/scenarios', json=INPUT, headers=HEADERS).status_code == 403


@pytest.mark.parametrize('code,status', [('42501',403), ('23505',409), ('23503',409), ('unknown',503)])
def test_database_errors_are_safe(code, status):
    def transport(request):
        if request.url.path.endswith('scenario_save'):
            return httpx.Response(400, json={'code': code, 'message': 'sb_secret_never_expose SQL internal details'})
        return upstream(request)
    with TestClient(create_app(ENV, httpx.MockTransport(transport))) as client:
        result = client.post('/api/scenarios', json=INPUT, headers=HEADERS)
        assert result.status_code == status and 'secret' not in result.text and 'SQL' not in result.text


def test_unverified_token_and_secret_config_never_accepted():
    def transport(request):
        assert request.url.path == '/auth/v1/user'
        return httpx.Response(401, json={'message': 'secret'})
    with TestClient(create_app(ENV, httpx.MockTransport(transport))) as client:
        assert client.get('/api/account/organizations', headers=HEADERS).status_code == 401
    with TestClient(create_app(ENV | {'SUPABASE_PUBLISHABLE_KEY': 'sb_secret_misconfigured'})) as client:
        result = client.get('/api/account/config')
        assert result.status_code == 503 and 'secret' not in result.text


def test_cursor_is_validated_and_queries_stay_scoped():
    with TestClient(create_app(ENV, httpx.MockTransport(upstream))) as client:
        assert client.get('/api/scenarios', params={'organizationId': ORG, 'cursor': 'or=organization_id.neq.x'}, headers=HEADERS).status_code == 400
        assert client.get('/api/scenarios', params={'organizationId': ORG, 'cursor': '2026-09-19T00:00:00+00:00|' + KEY}, headers=HEADERS).status_code == 200
