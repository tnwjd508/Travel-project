import copy
import calendar
import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.core import ApiError
from backend.tests.test_evidence import RELEASE, STAT, release_row, stat_row
from backend.tests.test_integration import fixtures

USER, ORG, SCENARIO = (str(uuid4()) for _ in range(3))
ENV = {'SUPABASE_URL':'https://database.example','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_test',
    'SUPABASE_SECRET_KEY':'sb_secret_test','TOUR_API_SERVICE_KEY':'tour-test'}
HEADERS = {'Authorization':'Bearer test-user', 'Idempotency-Key':str(uuid4())}


class DatabaseFixture:
    def __init__(self):
        self.rows, self.calls, self.tour_calls = {}, [], []
        self.role, self.ready, self.lose_response = 'editor', True, False
        self.latest = RELEASE
        self.scenario = dict(id=SCENARIO,organization_id=ORG,created_by=USER,title='동구 축제 조건',region_id='jeonnam-gwangju',
            district_id='12210',district_name='동구',policy_code='festival',policy_name='문화축제 개최',budget_krw=1500000000,
            start_month='2026-10-01',duration_months=6,briefing_month=None,created_at='2026-09-20T00:00:00Z')

    def __call__(self, request):
        if request.url.host == 'apis.data.go.kr':
            return fixtures(self.tour_calls)(request)
        self.calls.append(request.url.path)
        path, params = request.url.path, request.url.params
        if path == '/auth/v1/user':
            return httpx.Response(200,json={'id':USER})
        if path.endswith('organization_members'):
            return httpx.Response(200,json=[{'role':self.role}] if params['organization_id']=='eq.'+ORG and self.role else [])
        if path.endswith('simulation_scenarios'):
            return httpx.Response(200,json=[self.scenario] if params['organization_id']=='eq.'+ORG and params['id']=='eq.'+SCENARIO else [])
        if path.endswith('scenario_reviews') and '/rpc/' not in path:
            assert request.headers['authorization'] == HEADERS['Authorization']
            assert params['organization_id']=='eq.'+ORG
            rows = list(self.rows.values())
            for field in ('id','idempotency_key','scenario_id'):
                if field in params:
                    rows=[row for row in rows if row[field] == params[field].removeprefix('eq.')]
            return httpx.Response(200,json=[{key:row[key] for key in params['select'].split(',')} for row in rows])
        if path.endswith('rpc/review_contract'):
            assert request.headers['apikey']=='sb_secret_test'
            return httpx.Response(200,json={'rule_version':'festival-reference-v2','baseline_schema_version':1}) if self.ready else httpx.Response(404,json={'code':'PGRST202','message':'private SQL'})
        if path.endswith('policy_evidence_releases'):
            identifier = params.get('id','eq.'+self.latest).removeprefix('eq.')
            return httpx.Response(200,json=[release_row(identifier)])
        if path.endswith('policy_evidence_statistics'):
            identifier=params.get('release_id','eq.'+RELEASE).removeprefix('eq.')
            return httpx.Response(200,json=[stat_row(release=identifier)])
        if path.endswith('rpc/visitor_months_get'):
            args=json.loads(request.content)
            rows=[]
            for value in args['p_months']:
                ym=value[:7].replace('-','')
                days=calendar.monthrange(int(ym[:4]),int(ym[4:]))[1]
                rows.append(dict(ym=ym,total=days*30,local=days*10,outside=days*10,foreign=days*10,
                    complete=True,observedDays=days,expectedDays=days,through=f'{ym}{days:02}',sourceFetchedAt='2026-09-20T00:00:00Z'))
            return httpx.Response(200,json=rows)
        if path.endswith('rpc/visitor_months_store'):
            return httpx.Response(200,json=len(json.loads(request.content)['p_rows']))
        if path.endswith('rpc/tourism_cache_get'):
            return httpx.Response(200,json={'state':'missing'})
        if path.endswith('rpc/tourism_cache_store'):
            args=json.loads(request.content)
            return httpx.Response(200,json={'state':'stored','payload':args['p_response_payload'],'fetchedAt':args['p_source_fetched_at']})
        if path.endswith('rpc/save_scenario_review'):
            assert request.headers['apikey']=='sb_secret_test' and 'authorization' not in request.headers
            args=json.loads(request.content)
            assert args['p_user_id']==USER and args['p_organization_id']==ORG and args['p_scenario_id']==SCENARIO
            identifier=str(uuid4())
            row=dict(id=identifier,organization_id=ORG,scenario_id=SCENARIO,created_by=USER,evidence_statistic_id=STAT,
                reference_status='available',review_kind='historical_reference',selection_rule_version='festival-reference-v2',
                baseline_schema_version=1,baseline_status=args['p_baseline_status'],baseline_snapshot=args['p_baseline_snapshot'],
                idempotency_key=args['p_idempotency_key'],request_sha256=args['p_request_sha256'],created_at='2026-09-20T00:00:00Z')
            self.rows[identifier]=row
            if self.lose_response:
                self.lose_response=False
                raise httpx.ReadError('private upstream details')
            return httpx.Response(200,json=row)
        raise AssertionError(path)


def save(client, **extra):
    return client.post(f'/api/scenarios/{SCENARIO}/reviews',headers=HEADERS,json={'organizationId':ORG, **extra})


def test_real_district_collector_produces_frozen_review_and_retry_avoids_recollection():
    database=DatabaseFixture()
    with TestClient(create_app(ENV,httpx.MockTransport(database))) as client:
        response=save(client)
        assert response.status_code==200,response.text
        data=response.json()
        assert data['review']['baseline_status']=='complete'
        assert data['review']['baseline_snapshot']['summary']['visitors']['outside']==310
        assert data['review']['baseline_snapshot']['diagnosis']['activationIndex']==100
        assert data['evidence']['releaseId']==RELEASE and data['evidence']['stat']['n']==271
        assert 'request_sha256' not in response.text and 'secret' not in response.text
        count=len(database.tour_calls); calls=len(database.calls)
        database.latest=str(uuid4())
        assert save(client).json()==data
        assert len(database.tour_calls)==count
        assert '/rest/v1/rpc/review_contract' not in database.calls[calls:]
        assert save(client,releaseId=str(uuid4())).status_code==409
        detail=client.get('/api/scenario-reviews/'+data['review']['id'],params={'organizationId':ORG},headers=HEADERS)
        assert detail.json()==data
        assert client.get(f'/api/scenarios/{SCENARIO}/reviews',params={'organizationId':ORG},headers=HEADERS).json()['items'][0]['id']==data['review']['id']
        assert response.headers['cache-control']=='no-store'


def test_lost_save_response_is_recovered_without_duplicate_or_new_source_fetch():
    database=DatabaseFixture(); database.lose_response=True
    with TestClient(create_app(ENV,httpx.MockTransport(database))) as client:
        assert save(client).status_code==503
        count=len(database.tour_calls)
        assert save(client).status_code==200
        assert len(database.rows)==1 and len(database.tour_calls)==count


@pytest.mark.parametrize('role',['viewer',None])
def test_viewer_and_removed_members_cannot_write(role):
    database=DatabaseFixture(); database.role=role
    with TestClient(create_app(ENV,httpx.MockTransport(database))) as client:
        assert save(client).status_code==403
        assert not database.tour_calls and not database.rows


def test_old_database_contract_stops_before_any_source_calls_or_writes():
    database=DatabaseFixture(); database.ready=False
    with TestClient(create_app(ENV,httpx.MockTransport(database))) as client:
        result=save(client)
        assert result.status_code==503 and result.json()['code']=='DB_SCHEMA_NOT_READY'
        assert not database.tour_calls and not database.rows


@pytest.mark.parametrize('broken',['failure','district','unit','month','nan'])
def test_invalid_or_missing_summary_is_partial_and_never_saved_as_genuine_data(broken):
    database=DatabaseFixture()
    app=create_app(ENV,httpx.MockTransport(database))
    with TestClient(app) as client:
        original=app.state.service.execute
        async def execute(query):
            if query['resource']!='summary':
                return await original(query)
            if broken=='failure':
                raise ApiError(502,'UPSTREAM','private upstream message')
            data=copy.deepcopy(await original(query))
            if broken=='district': data['district']='11110'
            if broken=='unit': data['indexUnit']='hours'
            if broken=='month': data['visitors']['month']='202606'
            if broken=='nan': data['stay']['ix21']=float('nan')
            return data
        app.state.service.execute=execute
        response=save(client)
        assert response.status_code==200,response.text
        review=response.json()['review']
        assert review['baseline_status']=='partial' and review['baseline_snapshot']['summary'] is None
        assert review['baseline_snapshot']['diagnosis'] is not None
        assert 'private upstream' not in response.text


def test_missing_tour_key_records_unavailable_without_making_up_a_baseline():
    database=DatabaseFixture()
    with TestClient(create_app(ENV|{'TOUR_API_SERVICE_KEY':''},httpx.MockTransport(database))) as client:
        result=save(client)
        assert result.status_code==200,result.text
        assert result.json()['review']['baseline_status']=='unavailable'
        assert result.json()['review']['baseline_snapshot']['summary'] is None
        assert not database.tour_calls


def test_untrusted_inputs_cross_org_and_cursor_injection_are_rejected():
    database=DatabaseFixture()
    with TestClient(create_app(ENV,httpx.MockTransport(database))) as client:
        assert client.post(f'/api/scenarios/{SCENARIO}/reviews',json={'organizationId':ORG}).status_code==401
        assert save(client,baseline_snapshot={}).status_code==400
        assert save(client,created_by=USER).status_code==400
        assert save(client,organizationId=str(uuid4())).status_code==403
        assert client.get(f'/api/scenarios/{SCENARIO}/reviews',params={'organizationId':ORG,'cursor':'bad'},headers=HEADERS).status_code==400
        assert client.get(f'/api/scenario-reviews/{uuid4()}',params={'organizationId':ORG},headers=HEADERS).status_code==404
        assert not database.tour_calls and not database.rows
