"""Use the team's public TypeScript catalogue via a checked generated snapshot."""
import json
from pathlib import Path

from .core import ApiError

_snapshot = json.loads((Path(__file__).parent / 'data/tourism-regions.json').read_text(encoding='utf-8'))
CATALOGUE = {key: _snapshot[key] for key in ('updatedAt', 'provinces', 'districts')}
ALIASES = _snapshot['aliases']
BY_ID = {item['id']: item for item in CATALOGUE['districts']}
_GWANGJU_CODES = set(ALIASES.values())


def require_district(value, region_id=None):
    item = BY_ID.get(ALIASES.get(value, value))
    if item is None:
        raise ApiError(400, 'UNKNOWN_DISTRICT', '지원하는 시군구 코드를 선택해 주세요.')
    if region_id is not None:
        if region_id == 'gwangju':
            matches = item['id'] in _GWANGJU_CODES
        elif region_id == 'jeonnam':
            matches = item['regionId'] == 'jeonnam-gwangju' and item['id'] not in _GWANGJU_CODES
        else:
            matches = any(region_id in (p['id'], p['areaCode']) and p['id'] == item['regionId'] for p in CATALOGUE['provinces'])
        if not matches:
            raise ApiError(400, 'REGION_MISMATCH', '선택한 시도와 시군구의 소속이 일치하지 않습니다.')
    return item


def region_codes(district, ym, service):
    item = require_district(district)
    if service == 'KorService2':
        return item['areaCode'], item['districtCode']
    if ym < '202607' and item['id'] in ('28125', '28155', '28275', '28290'):
        raise ApiError(400, 'UNSUPPORTED_REGION_PERIOD', '이 지역은 2026년 7월 개편 이전 통계와 직접 비교할 수 없습니다.')
    old = ym < ('202608' if service == 'AreaTarResDemService' else '202607')
    code = item.get('legacyCode', item['id']) if old else item['id']
    return code[:2], code
