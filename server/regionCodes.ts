import { findTourismDistrict, requireTourismDistrict, type DistrictId } from '../src/data/tourismRegions.js'
import { ApiError } from './knto.js'

// 기존 summary?district=all 응답의 범위는 광주 5개 구로 유지합니다.
export const DISTRICTS = {
  donggu: { name: '동구', current: '12210', legacy: '29110', content: '210' },
  seogu: { name: '서구', current: '12240', legacy: '29140', content: '240' },
  namgu: { name: '남구', current: '12270', legacy: '29155', content: '270' },
  bukgu: { name: '북구', current: '12300', legacy: '29170', content: '300' },
  gwangsangu: { name: '광산구', current: '12330', legacy: '29200', content: '330' },
} as const
export type DistrictSlug = DistrictId
export function isDistrict(value: string): value is DistrictSlug {
  return Boolean(findTourismDistrict(value))
}
export function regionCodes(district: DistrictSlug, baseYm: string, service: string) {
  const d = requireTourismDistrict(district)
  // 관광 콘텐츠의 세종 코드는 36110/36110이며 통계 코드는 36/36110입니다.
  if (service === 'KorService2') return { area: d.areaCode, district: d.districtCode }
  const legacy = baseYm < (service === 'AreaTarResDemService' ? '202608' : '202607')
  const code = legacy && d.legacyCode ? d.legacyCode : d.id
  // 분구 전 자료를 현재 지역의 자료로 오인하지 않도록 조회를 제한합니다.
  if (baseYm < '202607' && ['28125', '28155', '28275', '28290'].includes(d.id)) throw new ApiError(400, 'UNSUPPORTED_REGION_PERIOD', '이 지역은 2026년 7월 개편 이전 통계와 직접 비교할 수 없습니다.')
  return { area: code.slice(0, 2), district: code }
}
