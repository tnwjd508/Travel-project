import httpx
from fastapi.testclient import TestClient
from backend.app import create_app
from backend.tests.test_evidence import release_row


def test_readiness_is_read_only_and_origin_protected():
    calls=[]
    def transport(request):
        calls.append(request)
        if request.url.path.endswith('rpc/review_contract'):
            return httpx.Response(200,json={'rule_version':'festival-reference-v2','baseline_schema_version':1})
        if request.url.path.endswith('rpc/briefing_get'):
            return httpx.Response(200,json={'state':'missing'})
        if request.url.path.endswith('rpc/visitor_months_get'):
            return httpx.Response(200,json=[])
        if request.url.path.endswith('rpc/tourism_cache_get'):
            return httpx.Response(200,json={'state':'missing'})
        assert request.method=='GET'
        return httpx.Response(200,json=[release_row()] if request.url.path.endswith('policy_evidence_releases') else [])
    env=dict(SUPABASE_URL='https://database.example',SUPABASE_PUBLISHABLE_KEY='sb_publishable_test',
        SUPABASE_SECRET_KEY='sb_secret_test',TOUR_API_SERVICE_KEY='tour-secret',GEMINI_API_KEY='model-secret',FASTAPI_PROXY_TOKEN='origin-secret')
    with TestClient(create_app(env,httpx.MockTransport(transport))) as client:
        assert client.get('/api/ready').status_code==401 and not calls
        result=client.get('/api/ready',headers={'X-Ongil-Proxy-Token':'origin-secret'})
        assert result.status_code==200,result.text
        assert all(result.json()['checks'].values())
        assert all(request.url.host=='database.example' for request in calls)
        assert 'secret' not in result.text and result.headers['cache-control']=='no-store'


def test_missing_config_and_old_schema_are_not_ready_without_internal_error_details():
    with TestClient(create_app({})) as client:
        result=client.get('/api/ready')
        assert result.status_code==503 and result.json()['checks']['database'] is False
    env=dict(SUPABASE_URL='https://database.example',SUPABASE_PUBLISHABLE_KEY='sb_publishable_test',SUPABASE_SECRET_KEY='sb_secret_test')
    with TestClient(create_app(env,httpx.MockTransport(lambda _: httpx.Response(404,json={'code':'PGRST202','message':'private error'})))) as client:
        result=client.get('/api/ready')
        assert result.status_code==503 and 'private error' not in result.text
