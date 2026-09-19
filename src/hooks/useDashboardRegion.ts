import { useParams } from 'react-router-dom'
import { resolveDashboardRegion } from '@/data/dashboardRegions'

// 대시보드 레이아웃이 유효한 지역을 검사한 뒤 하위 컴포넌트를 렌더링합니다.
export function useDashboardRegion() {
  const { regionId = 'gwangju', district = '' } = useParams()
  const active = resolveDashboardRegion(regionId, district)
  if (!active) throw new Error('대시보드의 지역 선택을 확인해 주세요.')
  return active
}
