import { regions } from './regions.js'
import { getGwangjuDistrict } from './gwangjuDistricts.js'
import { districtAliases, requireTourismDistrict, tourismProvinces, type DistrictId } from './tourismRegions.js'

export function getDisplayRegion(regionId: string) {
  const existing = regions.find(region => region.id === regionId)
  if (existing) return existing
  const province = tourismProvinces.find(region => region.id === regionId)
  return province ? { id: province.id, nameKo: province.name, nameEn: province.id, description: '지역의 관광 현황과 가능성을 살펴보세요', dashboardPath: `/regions/${province.id}`, status: 'available' as const, mapPosition: { x: 0, y: 0 }, accentColor: '#F4C57A', heroImage: undefined, heroAlt: undefined } : null
}

export function resolveDashboardRegion(regionId: string, value: string) {
  const region = getDisplayRegion(regionId)
  if (!region) return null
  try {
    const district = requireTourismDistrict(value, regionId)
    const legacy = regionId === 'gwangju' ? getGwangjuDistrict(value) ?? getGwangjuDistrict(Object.entries(districtAliases).find(([, code]) => code === district.id)?.[0]) : null
    const municipalityId: DistrictId = district.id
    return { regionId, regionName: region.nameKo, nameKo: district.name, slug: municipalityId, selectionPath: `/regions/${regionId}`, dashboardPath: `/dashboard/${regionId}/${municipalityId}/overview`, basePath: `/dashboard/${regionId}/${municipalityId}`, selection: { regionId, district: municipalityId }, region, legacy }
  } catch { return null }
}
