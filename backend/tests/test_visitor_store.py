import asyncio

from backend.core import ApiError, Freshness, trace
from backend.district import DistrictService, empty_visitors
from backend.regions import BY_ID
from backend.visitor_store import VisitorMonthStore


def complete_month(ym='202607'):
    return dict(ym=ym, total=60.0, local=10.0, outside=20.0, foreign=30.0,
        complete=True, observedDays=31, expectedDays=31, through=ym + '31')


class Database:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.calls = []

    async def call(self, method, path, *, payload, service):
        self.calls.append((method, path, payload, service))
        if path.endswith('visitor_months_get'):
            return self.rows
        return len(payload['p_rows'])


def test_store_reads_validated_months_and_builds_server_only_rows():
    database = Database([dict(complete_month(), sourceFetchedAt='2026-09-20T00:00:00Z')])
    store = VisitorMonthStore(database)
    token = trace.set(Freshness())
    try:
        result = asyncio.run(store.get_many('12210', ['202607']))
    finally:
        trace.reset(token)
    assert result == {'202607': complete_month()}
    get_call = database.calls[0]
    assert get_call[1].endswith('visitor_months_get') and get_call[3] is True
    assert get_call[2] == {'p_region_id': 'jeonnam-gwangju', 'p_district_id': '12210', 'p_months': ['2026-07-01']}

    values = {'12210': complete_month()}
    assert asyncio.run(store.store_month('202607', values, '2026-09-20T00:00:00Z')) == 1
    saved = database.calls[1][2]['p_rows'][0]
    assert saved['region_id'] == 'jeonnam-gwangju' and saved['district_id'] == '12210'
    assert saved['base_month'] == '2026-07-01' and saved['through_date'] == '2026-07-31'


def test_invalid_stored_month_is_rejected():
    database = Database([dict(complete_month(), observedDays=30, sourceFetchedAt='2026-09-20T00:00:00Z')])
    token = trace.set(Freshness())
    try:
        try:
            asyncio.run(VisitorMonthStore(database).get_many('12210', ['202607']))
            assert False, 'invalid complete month must fail'
        except ApiError as error:
            assert error.code == 'INVALID_STORED_VISITORS'
    finally:
        trace.reset(token)


class Stored:
    def __init__(self, rows):
        self.rows, self.saved, self.state = rows, [], {}

    async def get_many(self, _district, months):
        return {month: self.rows[month] for month in months if month in self.rows}

    async def store_month(self, ym, values, fetched_at):
        self.saved.append((ym, values, fetched_at))
        return len(values)

    async def collection_status(self, months):
        return {month: self.state.get(month, {'month': month, 'state': 'missing', 'attemptCount': 0}) for month in months}

    async def claim(self, ym, owner):
        self.state[ym] = {'month': ym, 'state': 'generating', 'owner': owner}
        return {'month': ym, 'state': 'claimed'}

    async def finish(self, ym, owner, values, fetched_at):
        self.state[ym] = {'month': ym, 'state': 'completed'}
        self.rows[ym] = values['12210']
        return {'month': ym, 'state': 'completed', 'storedRows': len(values)}

    async def fail(self, ym, owner, code, retry_seconds):
        self.state[ym] = {'month': ym, 'state': 'failed', 'errorCode': code}
        return self.state[ym]


class Source:
    def __init__(self, fail=False):
        self.fail, self.calls = fail, []
        self.cache = type('Cache', (), {'close': lambda self: None})()

    async def all(self, operation, params, ttl=86400, page_size=1000):
        self.calls.append((operation, params, ttl, page_size))
        if self.fail:
            raise ApiError(502, 'UPSTREAM_ERROR', 'failed')
        return [dict(signguCode='12210', baseYmd=f'202607{day:02}', touDivCd=str(kind), touNum='1')
            for day in range(1, 32) for kind in range(1, 4)]


def test_visitors_return_persisted_months_when_upstream_is_unavailable():
    store = Stored({'202607': complete_month()})
    service = DistrictService(Source(fail=True), store)
    token = trace.set(Freshness())
    try:
        series, previous, warnings, collection = asyncio.run(service.visitors('12210', '202607', 2))
    finally:
        trace.reset(token)
    assert series[-1] == complete_month()
    assert series[0] == empty_visitors('202606') and all(not row['complete'] for row in previous)
    assert any('3개월' in warning for warning in warnings)
    assert collection['status'] == 'missing' and len(service.client.calls) == 0


def test_successful_month_is_aggregated_once_and_persisted_for_every_district():
    source, store = Source(), Stored({})
    service = DistrictService(source, store)
    result = asyncio.run(service.source_visitor_month('202607'))
    assert result['12210'] == dict(ym='202607', total=93.0, local=31.0, outside=31.0, foreign=31.0,
        complete=True, observedDays=31, expectedDays=31, through='20260731')
    assert len(result) == len(BY_ID)
    assert source.calls[0][2:] == (2592000, 1000)
    assert store.saved[0][0] == '202607' and len(store.saved[0][1]) == len(BY_ID)


def test_public_series_fills_only_one_missing_nationwide_month_per_request():
    source, store = Source(), Stored({})
    service = DistrictService(source, store)
    token = trace.set(Freshness())
    try:
        series, previous, warnings, collection = asyncio.run(service.visitors('12210', '202607', 2))
    finally:
        trace.reset(token)
    assert len(source.calls) == 0
    assert series[-1] == empty_visitors('202607') and series[0] == empty_visitors('202606')
    assert all(not row['complete'] for row in previous)
    assert any('4개월' in warning for warning in warnings) and collection['status'] == 'missing'


def test_collection_claims_and_fills_one_missing_month():
    source, store = Source(), Stored({})
    service = DistrictService(source, store)
    result = asyncio.run(service.collect_next_visitor_month('12210', '202607', 2))
    assert result['state'] == 'completed' and result['month'] == '202607'
    assert len(source.calls) == 1 and store.rows['202607']['complete'] is True
