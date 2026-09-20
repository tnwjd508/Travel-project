import asyncio
import pytest
import httpx
from backend.core import ApiError, Cache, KntoClient, Budget, budget, parse_envelope, numeric


def test_envelope_and_redaction():
    assert parse_envelope('{"response":{"header":{"resultCode":"0000"},"body":{"totalCount":0,"items":""}}}') == ([], 0)
    with pytest.raises(ApiError) as result:
        parse_envelope('<returnReasonCode>22</returnReasonCode><secret>hidden</secret>')
    assert result.value.result_code == '22'
    assert 'hidden' not in result.value.message
    with pytest.raises(ApiError) as limited:
        parse_envelope('{"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"returnReasonCode":"22","errMsg":"private"}}}')
    assert limited.value.code == 'UPSTREAM_RATE_LIMIT' and limited.value.result_code == '22'
    assert 'private' not in limited.value.message
    with pytest.raises(ApiError) as authentication:
        parse_envelope('{"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"returnReasonCode":"30"}}}')
    assert authentication.value.code == 'UPSTREAM_AUTH'
    assert numeric('') is None and numeric(True) is None and numeric('NaN') is None


def test_cache_dedup_failure_and_budget():
    async def run():
        calls = 0
        async def fetch(request):
            nonlocal calls
            calls += 1
            return httpx.Response(200, json={'response': {'header': {'resultCode': '0000'}, 'body': {'totalCount': 0, 'items': ''}}})
        async with httpx.AsyncClient(transport=httpx.MockTransport(fetch)) as http:
            client = KntoClient('test-key', http)
            budget.set(Budget(maximum=1))
            await asyncio.gather(*[client.page('KorService2/areaBasedList2', {}) for _ in range(3)])
            assert calls == 1
            with pytest.raises(ApiError) as error:
                await client.page('KorService2/areaBasedList2', {'pageNo': '2'})
            assert error.value.code == 'REQUEST_BUDGET'
            with pytest.raises(ApiError):
                await client.page('KorService2/areaBasedList2', {'serviceKey': 'override'})
            await client.cache.close()
    asyncio.run(run())


def test_cancelled_waiter_does_not_cancel_shared_load_and_freshness_propagates():
    from backend.core import Freshness, trace
    async def run():
        import time
        cache = Cache()
        entered, finish = asyncio.Event(), asyncio.Event()
        calls = 0
        async def load():
            nonlocal calls
            calls += 1
            entered.set()
            await finish.wait()
            trace.get().expires = time.time() + 2
            return 'value'
        cancelled = asyncio.create_task(cache.get('same', 60, load))
        await entered.wait()
        cancelled.cancel()
        with pytest.raises(asyncio.CancelledError):
            await cancelled
        trace.set(Freshness())
        finish.set()
        assert await cache.get('same', 60, load) == 'value'
        assert calls == 1 and trace.get().expires <= time.time() + 2
        await cache.close()
    asyncio.run(run())
