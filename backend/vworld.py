"""VWorld-compatible GeoJSON adapter; keys stay in the FastAPI process."""
import math
import re
import httpx
from .core import ApiError, stamp
from .district import DISTRICTS

BOUNDS = {
    'donggu': ('24010', [35.0625, 126.8972, 35.1755, 127.0143]),
    'seogu': ('24020', [35.0809, 126.7906, 35.1886, 126.9197]),
    'namgu': ('24030', [35.0409, 126.7431, 35.1625, 126.9396]),
    'bukgu': ('24040', [35.1111, 126.8249, 35.2685, 127.0323]),
    'gwangsangu': ('24050', [35.0602, 126.6347, 35.2687, 126.8704]),
}

VWORLD_ERRORS = {
    'INCORRECT_KEY': ('INVALID_KEY', 'VWorld 인증키를 확인하세요.'),
    'INVALID_KEY': ('INVALID_KEY', 'VWorld 인증키를 확인하세요.'),
    'INCORRECT_DOMAIN': ('INVALID_DOMAIN', 'VWorld 인증키에 등록한 서비스 URL을 확인하세요.'),
    'INVALID_DOMAIN': ('INVALID_DOMAIN', 'VWorld 인증키에 등록한 서비스 URL을 확인하세요.'),
    'OVER_REQUEST_LIMIT': ('OVER_REQUEST_LIMIT', 'VWorld 일일 요청 한도를 초과했습니다.'),
}


def wfs_error(text):
    """Parse VWorld OWS/legacy XML without returning upstream text."""
    if not isinstance(text, str) or not text.lstrip().startswith('<'):
        return None
    match = re.search(r'\b(?:exceptionCode|code)=["\']([A-Za-z0-9_-]{1,32})["\']', text, re.IGNORECASE)
    upstream_code = match[1].upper() if match else ''
    return VWORLD_ERRORS.get(upstream_code, ('VWORLD_ERROR', 'VWorld가 오류를 반환했습니다.'))


def valid_ring(ring):
    return isinstance(ring, list) and len(ring) >= 4 and all(isinstance(p, list) and len(p) >= 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in p[:2]) for p in ring) and ring[0][:2] == ring[-1][:2]


async def boundary(district, env, http, cache):
    if district not in DISTRICTS:
        raise ApiError(400, 'UNKNOWN_DISTRICT', '지원하지 않는 자치구입니다.')
    if not env.get('VWORLD_API_KEY') or not env.get('VWORLD_DOMAIN'):
        raise ApiError(503, 'MISSING_KEY', 'VWorld 환경변수가 필요합니다.')

    async def load():
        code, box = BOUNDS[district]
        name = DISTRICTS[district][0]
        try:
            result = await http.get('https://api.vworld.kr/req/wfs', params=dict(service='WFS', request='GetFeature', version='1.1.0', typename='lt_c_ademd_info',
                bbox=','.join(map(str, box)), srsname='EPSG:4326', output='application/json', maxfeatures='500', key=env['VWORLD_API_KEY'], domain=env['VWORLD_DOMAIN']), timeout=20)
            error = wfs_error(result.text)
            if error:
                raise ApiError(502, error[0], error[1])
            result.raise_for_status()
            payload = result.json()
        except (httpx.HTTPError, ValueError):
            raise ApiError(502, 'UPSTREAM_UNAVAILABLE', 'VWorld 경계 데이터를 가져오지 못했습니다.') from None
        if not isinstance(payload, dict) or payload.get('type') != 'FeatureCollection' or not isinstance(payload.get('features'), list):
            raise ApiError(502, 'INVALID_RESPONSE', 'VWorld GeoJSON 형식이 올바르지 않습니다.')
        features = []
        for item in payload['features']:
            if not isinstance(item, dict) or not isinstance(item.get('properties'), dict):
                continue
            props = {k.lower(): str(v).strip() for k, v in item['properties'].items()}
            tokens = props.get('full_nm', '').split()
            geo = item.get('geometry') or {}
            if not isinstance(geo, dict):
                continue
            if len(tokens) < 3 or '광주' not in tokens[0] or tokens[1] != name or not props.get('emd_cd'):
                continue
            coordinates = geo.get('coordinates')
            polygons = [coordinates] if geo.get('type') == 'Polygon' else coordinates if geo.get('type') == 'MultiPolygon' else None
            if not isinstance(polygons, list) or not polygons or not all(isinstance(p, list) and p and all(valid_ring(r) for r in p) for p in polygons):
                continue
            features.append(dict(type='Feature', geometry=geo, properties=dict(code=props['emd_cd'], name=props.get('emd_kor_nm') or tokens[-1], districtCode=code, districtName=name)))
        if not features:
            raise ApiError(502, 'EMPTY_RESULT', '일치하는 행정동 경계가 없습니다. 잠시 후 다시 시도하세요.')
        return dict(type='FeatureCollection', source='vworld', layer='lt_c_ademd_info', district=dict(slug=district, code=code, name=name), fetchedAt=stamp(), features=sorted(features, key=lambda f: f['properties']['code']))
    return await cache.get(('vworld', district), 3600, load)
