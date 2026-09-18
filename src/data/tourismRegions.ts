import { regionCatalogueRows, regionCatalogueUpdatedAt } from './tourismRegionCatalogue.js'

// 화면의 지역 ID와 관광 API 코드를 한곳에서 관리합니다. 인증키는 포함하지 않습니다.
const provinceIds: Record<string, string> = {
  '11': 'seoul', '12': 'jeonnam-gwangju', '26': 'busan', '27': 'daegu',
  '28': 'incheon', '30': 'daejeon', '31': 'ulsan', '36110': 'sejong',
  '41': 'gyeonggi', '43': 'chungbuk', '44': 'chungnam', '47': 'gyeongbuk',
  '48': 'gyeongnam', '50': 'jeju', '51': 'gangwon', '52': 'jeonbuk',
}
export const districtAliases = {
  donggu: '12210', seogu: '12240', namgu: '12270', bukgu: '12300', gwangsangu: '12330',
} as const
export type DistrictId = keyof typeof districtAliases | `${number}`
export interface TourismDistrict {
  id: DistrictId
  name: string
  regionId: string
  areaCode: string
  districtCode: string
  legacyCode?: string
}
export interface TourismProvince { id: string; name: string; areaCode: string }
export interface RegionSelection { regionId: string; district: DistrictId }

export const tourismDistricts: TourismDistrict[] = regionCatalogueRows.map(([areaCode, , districtCode, name, legacy]) => ({
  id: (areaCode === '36110' ? '36110' : areaCode + districtCode) as DistrictId,
  name, regionId: provinceIds[areaCode], areaCode, districtCode, legacyCode: legacy || undefined,
}))
export const tourismProvinces: TourismProvince[] = [...new Map(regionCatalogueRows.map(([areaCode, name]) =>
  [areaCode, { id: provinceIds[areaCode], name, areaCode }],
)).values()]
const byId = new Map(tourismDistricts.map(district => [district.id, district]))
const gwangjuCodes = new Set<string>(Object.values(districtAliases))

export function findTourismDistrict(value: string): TourismDistrict | undefined {
  const canonical = Object.prototype.hasOwnProperty.call(districtAliases, value) ? districtAliases[value as keyof typeof districtAliases] : value
  return byId.get(canonical as DistrictId)
}
export function districtsForRegion(regionId: string): TourismDistrict[] {
  // 기존 광주 화면의 주소는 유지하면서 통합 시도 내의 광주 5개 구만 선택합니다.
  if (regionId === 'gwangju') return tourismDistricts.filter(d => gwangjuCodes.has(d.id))
  if (regionId === 'jeonnam') return tourismDistricts.filter(d => d.regionId === 'jeonnam-gwangju' && !gwangjuCodes.has(d.id))
  const province = tourismProvinces.find(p => p.id === regionId || p.areaCode === regionId)
  return province ? tourismDistricts.filter(d => d.regionId === province.id) : []
}
export function requireTourismDistrict(value: string, regionId?: string | null): TourismDistrict {
  const district = findTourismDistrict(value)
  if (!district) throw new Error('지원하는 시군구 코드를 선택해 주세요.')
  if (regionId !== undefined && regionId !== null && !districtsForRegion(regionId).some(d => d.id === district.id)) {
    throw new Error('선택한 시도와 시군구의 소속이 일치하지 않습니다.')
  }
  return district
}
export function regionQuery(selection: RegionSelection): URLSearchParams {
  requireTourismDistrict(selection.district, selection.regionId)
  return new URLSearchParams({ regionId: selection.regionId, district: selection.district })
}
export const regionCatalogue = { updatedAt: regionCatalogueUpdatedAt, provinces: tourismProvinces, districts: tourismDistricts }
