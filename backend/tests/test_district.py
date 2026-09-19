import asyncio
import pytest
from backend.core import ApiError
from backend.district import GROUPS, DistrictService, parse_query, region_codes, shift_month, sum_visitors


def test_code_migration():
    assert region_codes('namgu', '202606', 'DataLabService') == ('29', '29155')
    assert region_codes('namgu', '202607', 'DataLabService') == ('12', '12270')
    assert region_codes('donggu', '202607', 'AreaTarResDemService') == ('29', '29110')
    assert region_codes('donggu', '202608', 'AreaTarResDemService') == ('12', '12210')
    assert shift_month('202601', -1) == '202512'
    assert sum(len(g[2]) for g in GROUPS.values()) == 49


@pytest.mark.parametrize('resource,query', [('summary',[('district','constructor')]), ('summary',[('district','donggu'),('district','seogu')]), ('visitors',[('months','13')]), ('indices',[('baseYm','202613')]), ('festivals',[('from','20260230')]), ('contents',[('serviceKey','bad')])])
def test_query_validation(resource, query):
    with pytest.raises(ApiError):
        parse_query(resource, query, {})


def test_full_month_and_duplicate():
    rows = [dict(signguCode='12210', baseYmd=f'202607{day:02}', touDivCd=str(div), touNum='10') for day in range(1,32) for div in range(1,4)]
    assert sum_visitors(rows, 'donggu', '202607')['total'] == 930
    assert sum_visitors(rows[:-1], 'donggu', '202607')['total'] is None
    assert sum_visitors(rows + [rows[0]], 'donggu', '202607')['total'] == 930
    with pytest.raises(ApiError):
        sum_visitors(rows + [dict(rows[0], touNum='9')], 'donggu', '202607')
