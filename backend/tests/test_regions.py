import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient
from backend.app import create_app
from backend.core import ApiError
from backend.district import DistrictService, parse_query
from backend.regions import BY_ID, CATALOGUE, region_codes, require_district


def test_catalogue_and_service_specific_migrations():
    assert len(CATALOGUE['provinces']) == 16 and len(BY_ID) == 269
    for item in BY_ID.values():
        assert require_district(item['id'], item['regionId']) is item
    assert require_district('11140', 'seoul')['name'] == require_district('26110', 'busan')['name'] == '중구'
    assert require_district('gwangsangu', 'gwangju')['id'] == '12330'
    assert region_codes('36110', '202608', 'KorService2') == ('36110', '36110')
    assert region_codes('36110', '202608', 'DataLabService') == ('36', '36110')
    assert region_codes('12210', '202607', 'AreaTarResDemService') == ('29', '29110')
    mokpo = next(d for d in BY_ID.values() if d['name'] == '목포시')
    assert region_codes(mokpo['id'], '202606', 'DataLabService') == ('46', '46110')
    assert require_district(mokpo['id'], 'jeonnam') is mokpo
    with pytest.raises(ApiError):
        region_codes('28125', '202606', 'DataLabService')


@pytest.mark.parametrize('query', [[('regionId','seoul')], [('regionId','seoul'),('district','26110')], [('regionId','seoul'),('district','all')], [('regionId','seoul'),('regionId','busan'),('district','11110')]])
def test_query_rejects_wrong_missing_and_duplicate_parent_region(query):
    with pytest.raises(ApiError):
        parse_query('summary', query, {})


def test_national_month_aggregates_share_one_source_without_mixing_districts():
    rows = [dict(signguCode=code, baseYmd=f'202608{day:02}', touDivCd=str(div), touNum=amount)
        for day in range(1,32) for div in range(1,4) for code, amount in [('11110',1),('26110',2),('12210',3)]]
    class Client:
        calls = 0
        async def all(self, *args):
            self.calls += 1
            return rows
    async def run():
        client = Client()
        service = DistrictService(client)
        seoul, busan, gwangju = await asyncio.gather(*(service.visitor_month(d, '202608') for d in ('11110','26110','donggu')))
        assert [seoul['total'],busan['total'],gwangju['total']] == [93,186,279]
        assert gwangju == await service.visitor_month('12210', '202608')
        assert client.calls == 1
    asyncio.run(run())


def test_http_regions_and_seoul_sejong_contents_reach_matching_upstream():
    seen = []
    def upstream(request):
        seen.append(dict(request.url.params))
        return httpx.Response(200,json={'response':{'header':{'resultCode':'0000'},'body':{'totalCount':0,'items':''}}})
    with TestClient(create_app({'TOUR_API_SERVICE_KEY':'fixture-key'}, httpx.MockTransport(upstream))) as client:
        assert client.get('/api/regions').json() == CATALOGUE
        assert client.post('/api/regions').status_code == 405
        for region, district in [('seoul','11110'),('sejong','36110')]:
            result=client.get(f'/api/district/contents?regionId={region}&district={district}')
            assert result.status_code == 200 and result.json()['district'] == district
        assert seen[0]['lDongRegnCd'] == '11' and seen[0]['lDongSignguCd'] == '110'
        assert seen[1]['lDongRegnCd'] == seen[1]['lDongSignguCd'] == '36110'
        assert client.get('/api/district/contents?regionId=busan&district=11110').status_code == 400
        assert len(seen) == 2
