import { useDashboardRegion } from './useDashboardRegion'

export function useActiveDistrict() {
  // main의 페이지는 그대로 사용하고, 이름과 API 코드는 현재 URL의 지역에서 얻습니다.
  const district = useDashboardRegion()
  return { ...district, tourismType: district.legacy?.tourismType ?? '지역 관광' }
}
