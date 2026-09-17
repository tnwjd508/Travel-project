import { useMemo } from 'react'
import type { GwangjuDistrict } from '@/data/gwangjuDistricts'
import { getStaticNeighborhoods } from '@/data/gwangjuNeighborhoods'
import { useVWorldLegalDongBoundaries } from '@/hooks/useVWorldLegalDongBoundaries'
import type { NeighborhoodFeature, NeighborhoodSource } from '@/types/boundary'

// 활성 자치구의 동 단위 경계. VWorld 법정동(프록시 경유)을 우선 쓰고, 없으면 정적 행정동 경계로 대체한다.
export function useDistrictNeighborhoods(district: GwangjuDistrict) {
  const { features, status, errorMessage, retry } = useVWorldLegalDongBoundaries(district)

  const source: NeighborhoodSource = status === 'ready' && features.length > 0 ? 'vworld' : 'static'
  const neighborhoods: NeighborhoodFeature[] = useMemo(
    () => (source === 'vworld' ? features : getStaticNeighborhoods(district.code)),
    [source, features, district.code],
  )

  return { neighborhoods, source, status, errorMessage, retry }
}
