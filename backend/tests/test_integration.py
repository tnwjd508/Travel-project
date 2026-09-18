"""HTTP contracts and request fan-out with deterministic upstream fixtures."""
import calendar
from urllib.parse import urlsplit

import httpx
from fastapi.testclient import TestClient
from backend.app import create_app
from backend.district import GROUPS


def fixtures(calls, missing_rank=False):
    def respond(request):
        calls.append(request)
        operation = '/'.join(urlsplit(str(request.url)).path.split('/')[-2:])
        p = request.url.params
        rows = []
        if operation.startswith('DataLabService/'):
            ym = p['startYmd'][:6]
            code = '29110' if ym < '202607' else '12210'
            rows = [dict(signguCode=code, baseYmd=f'{ym}{day:02}', touDivCd=str(div), touNum='10')
                for day in range(1, calendar.monthrange(int(ym[:4]), int(ym[4:]))[1] + 1) for div in range(1, 4)]
        elif operation.startswith(('AreaTarDemDsService/', 'AreaTarDivService/', 'AreaTarResDemService/')):
            _, field, _ = next(g for g in GROUPS.values() if g[0] == operation)
            code = p.get('signguCd') or ('12210' if p['areaCd'] == '12' else p['areaCd'] + '110')
            rows = [dict(baseYm=p['baseYm'], signguCd=code, **{field+'Cd': p[field+'Cd'], field+'Val': None if missing_rank and p.get('areaCd') == '11' else '100'})]
            if 'signguCd' not in p:
                rows.append(dict(baseYm=p['baseYm'], signguCd='0', **{field+'Cd': p[field+'Cd'], field+'Val': '999'}))
        elif operation == 'TarRlteTarService1/areaBasedList1':
            rows = [dict(baseYm=p['baseYm'], signguCd=p['signguCd'], tAtsCd=str(i), tAtsNm=f'Hub {i}', rlteTatsCd='x', rlteCtgryMclsNm='culture') for i in range(5)]
        elif operation == 'KorService2/areaBasedList2':
            rows = [dict(contentid='1', title='Place', mapx='126.9', mapy='35.1', lclsSystm1='VE')]
        elif operation == 'KorService2/searchFestival2':
            rows = [dict(contentid='2', title='Festival', eventstartdate='20260901', eventenddate='20260930')]
        return httpx.Response(200, json={'response': {'header': {'resultCode': '0000'}, 'body': {'totalCount': len(rows), 'items': {'item': rows}}}})
    return respond


def test_cold_diagnosis_19_calls_no_automatic_nationwide_rank():
    calls = []
    with TestClient(create_app({'TOUR_API_SERVICE_KEY': 'test-secret'}, httpx.MockTransport(fixtures(calls)))) as client:
        result = client.get('/api/district/diagnosis')
        assert result.status_code == 200
        body = result.json()
        assert len(calls) == 19
        assert body['activationIndex'] == 100
        assert body['priorities'] == []
        assert all(issue['status'] == 'normal' for issue in body['issues'])
        assert body['model']['status'] == 'provisional'
        assert 'test-secret' not in result.text
        assert client.get('/api/district/diagnosis').json() == body
        assert len(calls) == 19


def test_all_resources_contract_and_missing_rank():
    with TestClient(create_app({'TOUR_API_SERVICE_KEY': 'test-secret'}, httpx.MockTransport(fixtures([], missing_rank=True)))) as client:
        for resource in ['summary', 'visitors', 'indices', 'contents', 'festivals', 'related', 'rank', 'diagnosis']:
            result = client.get('/api/district/' + resource)
            assert result.status_code == 200, (resource, result.text)
            body = result.json()
            assert body['source'] == '출처: ⓒ한국관광공사'
            assert body['fetchedAt'] and isinstance(body['warnings'], list)
            if resource == 'visitors':
                assert len(body['series']) == len(body['previousYear']) == 12
                assert all(m['complete'] for m in body['series'])
            if resource == 'rank':
                assert body['rank'] is None and not body['complete']
                assert '11' in body['missingAreas']
                assert body['populationVerified'] is False
            if resource == 'indices':
                assert sum(map(len, body['groups'].values())) == 49


def test_origin_auth_and_static_api_boundary():
    with TestClient(create_app({'FASTAPI_PROXY_TOKEN': 'private-token'})) as client:
        assert client.get('/api/health').status_code == 200
        for path in ['/api/district/contents', '/api/tourism', '/api/vworld?district=donggu']:
            result = client.get(path)
            assert result.status_code == 401 and 'private-token' not in result.text
        result = client.get('/api/district/contents', headers={'X-Ongil-Proxy-Token': 'private-token'})
        assert result.status_code == 503  # Correct token reaches missing source-key validation.
        assert client.get('/api/unknown', headers={'X-Ongil-Proxy-Token': 'private-token'}).status_code == 404
