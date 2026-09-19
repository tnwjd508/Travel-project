import asyncio
import shutil

import pytest
from fastapi.testclient import TestClient
from backend.app import create_app
from backend.briefing import BriefingWorker
from backend.core import ApiError


def test_monthly_http_preserves_validation_and_missing_key_status():
    with TestClient(create_app({})) as client:
        assert client.get('/api/monthly-briefing?regionId=seoul&district=26110').status_code == 400
        assert client.get('/api/monthly-briefing?district=donggu').status_code == 503
        process = client.app.state.briefing.process
        assert client.get('/api/monthly-briefing?district=donggu&district=seogu').status_code == 400
        assert client.app.state.briefing.process is process
        result = client.post('/api/monthly-briefing?district=donggu')
        assert result.status_code == 503 and result.json()['code'] == 'DB_NOT_CONFIGURED'
        rejected = client.delete('/api/monthly-briefing?district=donggu')
        assert rejected.status_code == 405 and rejected.headers['allow'] == 'GET, POST'
    assert process.returncode is not None


def test_persistent_worker_reads_database_and_does_not_generate_on_get():
    node = shutil.which('node')
    command = [node, '--import', 'tsx', '--import', './backend/tests/fixtures/mock_briefing_fetch.mjs', 'server/briefing/bridge.ts']
    async def run():
        worker = BriefingWorker({'TOUR_API_SERVICE_KEY':'fixture-secret', 'SUPABASE_URL': 'https://database.example', 'SUPABASE_SECRET_KEY': 'sb_secret_fixture'}, command)
        try:
            query = [('regionId','seoul'),('district','11110')]
            first, second = await asyncio.gather(worker.request('GET',query),worker.request('GET',query))
            process = worker.process
            assert first['status'] == second['status'] == 202
            assert first['body'] == second['body']
            assert first['body']['state'] == 'generating'
            cached = await worker.request('GET',query)
            assert cached['body'] == first['body'] and worker.process is process
            busan = await worker.request('GET',[('regionId','busan'),('district','26110')])
            assert busan['status'] == 404 and busan['body']['state'] == 'missing'
            assert (await worker.request('POST', query))['status'] == 202
            missing = await worker.request('POST', [('regionId','busan'),('district','26110')])
            assert missing['status'] == 503 and missing['body']['code'] == 'AI_NOT_CONFIGURED'
            assert 'fixture-secret' not in str(first)
            assert not worker.pending
        finally:
            await worker.close()
        assert process.returncode is not None
    asyncio.run(run())


def test_monthly_http_forwards_post_and_polling_headers():
    with TestClient(create_app({})) as client:
        calls = []
        async def request(method, query):
            calls.append((method, query))
            return {'status': 202, 'body': {'state': 'generating'}}
        client.app.state.briefing.request = request
        response = client.post('/api/monthly-briefing?regionId=seoul&district=11110')
        assert response.status_code == 202 and response.headers['retry-after'] == '5'
        assert calls == [('POST', [('regionId', 'seoul'), ('district', '11110')])]


def test_worker_crash_is_redacted_and_next_request_can_restart():
    async def run():
        worker = BriefingWorker({}, [shutil.which('node'),'-e',"console.error('secret'); process.exit(1)"])
        with pytest.raises(ApiError) as error:
            await worker.request('GET',[])
        assert error.value.code == 'BRIEFING_UNAVAILABLE' and 'secret' not in error.value.message
        worker.command = [shutil.which('node'),'--import','tsx','server/briefing/bridge.ts']
        assert (await worker.request('GET',[('district','donggu')]))['status'] == 503
        await worker.close()
    asyncio.run(run())
