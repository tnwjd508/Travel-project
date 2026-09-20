"""실행: backend/.venv/Scripts/python.exe -m pytest scripts/festival-effect -q"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from analyze import is_metro_gu  # noqa: E402
from merge_festivals import code_from_address, deduplicate  # noqa: E402


def test_metro_gu_includes_all_city_districts_and_only_gwangju_in_merged_province():
    assert is_metro_gu('11680')  # 서울 강남구 (예전 버그: 코드 400 이상 구가 빠짐)
    assert is_metro_gu('11710')  # 서울 송파구: 군 코드 범위로 오인하면 안 됨
    assert is_metro_gu('11740')  # 서울 강동구
    assert is_metro_gu('12210')  # 광주 동구
    assert not is_metro_gu('12130')  # 전남 여수시 (예전 버그: 광역시 구로 섞임)
    assert not is_metro_gu('26710')  # 부산 기장군
    assert not is_metro_gu('41135')  # 경기 성남시 분당구


def test_address_maps_to_current_district_code():
    table = {'12': {'동구': '12210', '여수시': '12130'}, '41': {'수원시 장안구': '41111'}, '36': {'세종시': '36110'}}
    assert code_from_address('광주광역시 동구 금남로 1', table) == '12210'
    assert code_from_address('전남광주통합특별시 동구 문화전당로 38', table) == '12210'
    assert code_from_address('전라남도 여수시 시청로 1', table) == '12130'
    assert code_from_address('경기도 수원시 장안구 정조로', table) == '41111'
    assert code_from_address('세종특별자치시 한누리대로', table) == '36110'
    assert code_from_address('주소없음', table) is None


def test_deduplicate_keeps_short_festival_inside_long_event():
    long_event = dict(title='차 없는 거리', start='20260404', end='20261107', code='12210', source='표준데이터')
    night = dict(title='국가유산야행', start='20260424', end='20260425', code='12210', source='관광공사')
    same_night = dict(title='국가유산 야행', start='20260424', end='20260425', code='12210', source='표준데이터')
    kept = deduplicate([long_event, night, same_night])
    assert [f['title'] for f in kept] == ['국가유산야행', '차 없는 거리']
