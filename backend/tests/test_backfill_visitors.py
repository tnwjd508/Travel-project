import pytest

from backend.backfill_visitors import month_range


def test_month_range_is_ordered_and_bounded():
    assert month_range('2026-06', '2026-08') == ['202606', '202607', '202608']
    assert month_range('2025-12', '2026-01') == ['202512', '202601']
    with pytest.raises(ValueError):
        month_range('2026-08', '2026-07')
    with pytest.raises(ValueError):
        month_range('2024-01', '2026-02')
    with pytest.raises(ValueError):
        month_range('2026-13', '2026-13')
