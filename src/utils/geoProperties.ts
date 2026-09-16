import type { DistrictSlug } from '@/data/gwangjuDistricts'

type GeoProperties = Record<string, unknown>

const districtSlugByName: Record<string, DistrictSlug> = {
  동구: 'donggu',
  서구: 'seogu',
  남구: 'namgu',
  북구: 'bukgu',
  광산구: 'gwangsangu',
}

function readFirstString(properties: GeoProperties, keys: string[]) {
  for (const key of keys) {
    const value = properties[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return null
}

export function getDistrictName(properties: GeoProperties) {
  return readFirstString(properties, ['name', 'SIGUNGU_NM', 'SIG_KOR_NM', 'SGG_NM', 'adm_nm'])
}

export function getDistrictCode(properties: GeoProperties) {
  return readFirstString(properties, ['code', 'SIGUNGU_CD', 'SIG_CD', 'SGG_CD'])
}

export function getDistrictSlug(name: string | null | undefined) {
  return name ? districtSlugByName[name] ?? null : null
}
