import asyncio

import httpx

from backend.core import Budget, Freshness, KntoClient, budget, trace
from backend.tourism_cache import TourismApiStore, cache_identity


def test_cache_identity_is_order_independent_and_contains_no_credentials():
    first = cache_identity('KorService2/areaCode2', {'pageNo': '1', 'numOfRows': '10'})
    second = cache_identity('KorService2/areaCode2', {'numOfRows': '10', 'pageNo': '1'})
    assert first == second and len(first[0]) == 64
    assert 'serviceKey' not in first[1]


class Database:
    def __init__(self, value):
        self.value, self.calls = value, []

    async def call(self, method, path, *, payload, service):
        self.calls.append((method, path, payload, service))
        if path.endswith('tourism_cache_get'):
            return self.value
        return {'state': 'stored', 'payload': payload['p_response_payload'], 'fetchedAt': payload['p_source_fetched_at']}


def test_tourism_store_validates_get_and_store_contracts():
    database = Database({'state': 'stored', 'payload': {'items': [{'id': '1'}], 'totalCount': 1},
        'fetchedAt': '2026-09-20T00:00:00Z'})
    store = TourismApiStore(database)
    cached = asyncio.run(store.get('KorService2/areaCode2', {'pageNo': '1'}))
    assert cached['items'] == [{'id': '1'}] and cached['total'] == 1 and cached['age'] >= 0
    asyncio.run(store.store('KorService2/areaCode2', {'pageNo': '1'}, [{'id': '2'}], 1, '2026-09-20T00:00:00Z'))
    assert database.calls[0][3] is True and database.calls[1][2]['p_response_payload']['items'][0]['id'] == '2'


class Cache:
    def __init__(self, cached):
        self.cached, self.stored = cached, []

    async def get(self, _operation, _params):
        return self.cached

    async def store(self, *args):
        self.stored.append(args)


def test_knto_uses_fresh_cache_and_stale_cache_on_upstream_failure():
    async def run():
        calls = 0
        async def upstream(_request):
            nonlocal calls
            calls += 1
            return httpx.Response(503, text='unavailable')
        async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as http:
            page = dict(items=[{'id': 'cached'}], total=1, fetchedAt='2026-09-20T00:00:00Z', age=1)
            current = Cache(page)
            trace.set(Freshness()); budget.set(Budget())
            assert await KntoClient('key', http, current).page('KorService2/areaCode2', {}) == ([{'id': 'cached'}], 1)
            assert calls == 0

            stale = Cache({**page, 'age': 999999})
            trace.set(Freshness()); budget.set(Budget())
            assert await KntoClient('key', http, stale).page('KorService2/areaCode2', {}) == ([{'id': 'cached'}], 1)
            assert calls == 1
    asyncio.run(run())


def test_paginated_collection_calls_only_pages_missing_from_shared_cache():
    class Pages:
        async def get(self, _operation, params):
            page=int(params['pageNo'])
            if page > 2: return None
            return dict(items=[{'page':page,'row':index} for index in range(1000)], total=2500,
                fetchedAt='2026-09-20T00:00:00Z', age=1)
        async def store(self, *_args): pass
    async def run():
        calls=[]
        async def upstream(request):
            calls.append(int(request.url.params['pageNo']))
            return httpx.Response(200,json={'response':{'header':{'resultCode':'0000'},
                'body':{'totalCount':2500,'items':{'item':[{'page':3,'row':index} for index in range(500)]}}}})
        async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as http:
            client=KntoClient('key',http,Pages())
            rows=await client.all('DataLabService/locgoRegnVisitrDDList',{'startYmd':'20260701','endYmd':'20260731'},86400,1000)
            assert len(rows)==2500 and calls==[3]
    asyncio.run(run())
