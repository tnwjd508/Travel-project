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
        assert result.status_code == 405 and result.headers['allow'] == 'GET'
    assert process.returncode is not None


def test_persistent_worker_runs_original_graph_and_reuses_region_cache():
    node = shutil.which('node')
    command = [node, '--import', 'tsx', '--import', './backend/tests/fixtures/mock_briefing_fetch.mjs', 'server/briefing/bridge.ts']
    async def run():
        worker = BriefingWorker({'TOUR_API_SERVICE_KEY':'fixture-secret'}, command)
        try:
            query = [('regionId','seoul'),('district','11110')]
            first, second = await asyncio.gather(worker.request('GET',query),worker.request('GET',query))
            process = worker.process
            assert first['status'] == second['status'] == 200
            assert first['body'] == second['body']
            assert first['body']['aiStatus'] == 'unavailable'
            assert len(first['body']['sources']) == 10 and first['body']['evidence']
            cached = await worker.request('GET',query)
            assert cached['body'] == first['body'] and worker.process is process
            busan = await worker.request('GET',[('regionId','busan'),('district','26110')])
            assert busan['body']['district'] == '26110'
            assert 'fixture-secret' not in str(first)
            assert not worker.pending
        finally:
            await worker.close()
        assert process.returncode is not None
    asyncio.run(run())


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
