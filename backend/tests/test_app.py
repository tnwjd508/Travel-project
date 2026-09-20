import httpx
import pytest
from fastapi.testclient import TestClient
from backend.app import create_app


def test_health_validation_missing_key_and_docs():
    with TestClient(create_app({})) as client:
        assert client.get('/api/health').json()['backend'] == 'fastapi'
        assert client.get('/api/district/summary').status_code == 503
        assert client.get('/api/district/summary?district=bad').status_code == 400
        assert client.get('/api/district/summary?district=donggu&district=seogu').status_code == 400
        assert client.get('/api/district/unknown').status_code == 404
        assert client.post('/api/district/summary').status_code == 405
        assert client.get('/api/no-such-path').status_code == 404
        assert client.get('/openapi.json').status_code == 200
        assert client.get('/api/district/summary').headers['cache-control'] == 'no-store'


def test_content_http_contract():
    def upstream(request):
        assert request.url.host == 'apis.data.go.kr'
        assert request.url.params['serviceKey'] == 'test-key'
        return httpx.Response(200, json={'response': {'header': {'resultCode': '0000'}, 'body': {'items': {'item': [{'contentid': '123', 'title': '테스트', 'lclsSystm1': 'VE', 'mapx': '126.9', 'mapy': '35.1'}]}, 'totalCount': 1}}})
    with TestClient(create_app({'TOUR_API_SERVICE_KEY': 'test-key'}, httpx.MockTransport(upstream))) as client:
        result = client.get('/api/district/contents?district=donggu')
        assert result.status_code == 200
        assert result.json()['items'][0]['lng'] == 126.9
        assert result.json()['typeShare'][0]['pct'] == 100
        assert 'test-key' not in result.text
        assert 's-maxage=' in result.headers['cache-control']


def test_vworld_empty_result_is_not_cached():
    calls = 0
    def upstream(request):
        nonlocal calls
        calls += 1
        feature = dict(type='Feature', properties={'full_nm': '광주광역시 동구 충장동', 'emd_cd': '29110525', 'emd_kor_nm': '충장동'},
            geometry={'type': 'Polygon', 'coordinates': [[[126.9,35.1],[126.91,35.1],[126.91,35.11],[126.9,35.1]]]})
        return httpx.Response(200, json={'type': 'FeatureCollection', 'features': [] if calls == 1 else [feature]})
    with TestClient(create_app({'VWORLD_API_KEY': 'secret', 'VWORLD_DOMAIN': 'https://example.test'}, httpx.MockTransport(upstream))) as client:
        assert client.get('/api/vworld?district=donggu').status_code == 502
        assert len(client.get('/api/vworld?district=donggu').json()['features']) == 1
        assert client.get('/api/vworld?district=donggu').status_code == 200
        assert calls == 2


@pytest.mark.parametrize(('body', 'expected'), [
    ('<ExceptionReport><Exception exceptionCode="INCORRECT_KEY"><ExceptionText>secret-key</ExceptionText></Exception></ExceptionReport>', 'INVALID_KEY'),
    ('<ServiceExceptionReport><ServiceException code="INVALID_KEY">secret-key</ServiceException></ServiceExceptionReport>', 'INVALID_KEY'),
    ('<ServiceExceptionReport><ServiceException code="INVALID_DOMAIN">private-domain</ServiceException></ServiceExceptionReport>', 'INVALID_DOMAIN'),
    ('<ServiceExceptionReport><ServiceException code="OVER_REQUEST_LIMIT">private-limit</ServiceException></ServiceExceptionReport>', 'OVER_REQUEST_LIMIT'),
    ('<ServiceExceptionReport><ServiceException code="UNKNOWN_PRIVATE_CODE">private-detail</ServiceException></ServiceExceptionReport>', 'VWORLD_ERROR'),
])
def test_vworld_xml_errors_are_classified_without_leaking_upstream(body, expected):
    def upstream(request):
        return httpx.Response(200, text=body)
    with TestClient(create_app({'VWORLD_API_KEY': 'secret-key', 'VWORLD_DOMAIN': 'https://example.test'}, httpx.MockTransport(upstream))) as client:
        result = client.get('/api/vworld?district=donggu')
        assert result.status_code == 502 and result.json()['code'] == expected
        assert not any(secret in result.text for secret in ('secret-key', 'private-domain', 'private-limit', 'private-detail', 'UNKNOWN_PRIVATE_CODE'))


@pytest.mark.parametrize(('upstream', 'expected'), [
    (lambda request: httpx.Response(403, text='<html>blocked</html>'), 'UPSTREAM_HTTP'),
    (lambda request: httpx.Response(200, text='<html>not geojson</html>'), 'INVALID_RESPONSE'),
    (lambda request: (_ for _ in ()).throw(httpx.ConnectError('private network detail', request=request)), 'UPSTREAM_NETWORK'),
    (lambda request: (_ for _ in ()).throw(httpx.ReadTimeout('private timeout detail', request=request)), 'UPSTREAM_TIMEOUT'),
])
def test_vworld_transport_failures_are_distinct_and_redacted(upstream, expected):
    with TestClient(create_app({'VWORLD_API_KEY': 'secret-key', 'VWORLD_DOMAIN': 'https://example.test'}, httpx.MockTransport(upstream))) as client:
        result = client.get('/api/vworld?district=donggu')
        assert result.status_code == 502 and result.json()['code'] == expected
        assert not any(secret in result.text for secret in ('secret-key', 'private network detail', 'private timeout detail'))
