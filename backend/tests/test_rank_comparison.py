"""전국 비교 통계가 순위와 같은 표본을 사용하는지 확인합니다."""
import asyncio

import pytest

from backend.core import ApiError
from backend.district import DistrictService


class RankClient:
    def __init__(self, extra=None, missing_area=None, missing_target=False):
        self.extra = extra or []
        self.missing_area = missing_area
        self.missing_target = missing_target

    async def all(self, operation, params):
        areas = ['11', '26', '27', '28', '30', '31', '36', '41', '43', '44', '47', '48', '50', '51', '52', '12']
        area = params['areaCd']
        if area == self.missing_area:
            return []
        code = '12210' if area == '12' else area + '110'
        value = 80 if area == '12' else (areas.index(area) + 1) * 10
        row = dict(signguCd=code, baseYm='202608', tarSjrnDsIxCd='21', tarSjrnDsIxVal=value)
        if area == '12' and self.missing_target:
            row['tarSjrnDsIxVal'] = None
        # 시도 합계와 동일 중복 행은 비교 통계의 표본에 추가되면 안 됩니다.
        return [row, dict(row), dict(row, signguCd='0', tarSjrnDsIxVal=99999)] + (self.extra if area == '11' else [])


def compare(client):
    return asyncio.run(DistrictService(client).rank('donggu', '202608', '21'))


def test_even_sample_and_ties_exclude_aggregate_and_duplicates():
    result = compare(RankClient())
    assert result['complete'] is True
    assert result['total'] == 16
    assert result['value'] == 80
    assert result['mean'] == 80
    assert result['median'] == 80
    assert result['rank'] == 8
    assert result['tieCount'] == 2


def test_odd_sample_outlier_changes_mean_not_median():
    extra = [dict(signguCd='11120', baseYm='202608', tarSjrnDsIxCd='21', tarSjrnDsIxVal=1000)]
    result = compare(RankClient(extra))
    assert result['total'] == 17
    assert result['median'] == 80
    assert result['mean'] == pytest.approx(2280 / 17)


@pytest.mark.parametrize('client', [RankClient(missing_area='11'), RankClient(missing_target=True)])
def test_incomplete_sample_does_not_publish_comparison_statistics(client):
    result = compare(client)
    assert result['complete'] is False
    for field in ('rank', 'mean', 'median', 'tieCount'):
        assert result[field] is None


def test_conflicting_duplicate_is_rejected():
    extra = [dict(signguCd='11110', baseYm='202608', tarSjrnDsIxCd='21', tarSjrnDsIxVal=999)]
    with pytest.raises(ApiError, match='중복'):
        compare(RankClient(extra))
