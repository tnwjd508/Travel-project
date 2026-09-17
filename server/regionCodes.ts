export const DISTRICTS = {
  donggu: { name: '동구', current: '12210', legacy: '29110', content: '210' },
  seogu: { name: '서구', current: '12240', legacy: '29140', content: '240' },
  namgu: { name: '남구', current: '12270', legacy: '29155', content: '270' },
  bukgu: { name: '북구', current: '12300', legacy: '29170', content: '300' },
  gwangsangu: { name: '광산구', current: '12330', legacy: '29200', content: '330' },
} as const
export type DistrictSlug = keyof typeof DISTRICTS
export function isDistrict(value: string): value is DistrictSlug {
  return Object.hasOwn(DISTRICTS, value)
}
export function regionCodes(district: DistrictSlug, baseYm: string, service: string) {
  const d = DISTRICTS[district]
  if (service === 'KorService2') return { area: '12', district: d.content }
  const legacy = baseYm < (service === 'AreaTarResDemService' ? '202608' : '202607')
  return { area: legacy ? '29' : '12', district: legacy ? d.legacy : d.current }
}
