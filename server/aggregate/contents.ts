import { KntoClient, numeric, type Row } from '../knto.js'
import { regionCodes, type DistrictSlug } from '../regionCodes.js'
export const asText = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
export function imageUrl(value: unknown): string | null {
  try { const url = new URL(asText(value)); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null }
}
export function distribution(categories: string[]) {
  const counts = new Map<string, number>()
  categories.forEach(category => counts.set(category, (counts.get(category) ?? 0) + 1))
  return [...counts].map(([category, count]) => ({ category, count, pct: count / categories.length * 100 })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
}
function uniqueContent(rows: Row[]) {
  return [...new Map(rows.filter(row => asText(row.contentid)).map(row => [asText(row.contentid), row])).values()]
}
export async function getContents(client: KntoClient, district: DistrictSlug, ym: string, contentTypeId?: string) {
  const codes = regionCodes(district, ym, 'KorService2')
  const rows = uniqueContent(await client.all('KorService2/areaBasedList2', { lDongRegnCd: codes.area, lDongSignguCd: codes.district, ...(contentTypeId ? { contentTypeId } : {}), arrange: 'O' }, 3600))
  const items = rows.map(row => {
    const lng = numeric(row.mapx); const lat = numeric(row.mapy)
    const valid = lng !== null && lat !== null && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90 && (lng !== 0 || lat !== 0)
    return { contentId: asText(row.contentid), title: asText(row.title), lng: valid ? lng : null, lat: valid ? lat : null,
      category: asText(row.lclsSystm1) || 'unknown', image: imageUrl(row.firstimage), addr: [row.addr1, row.addr2].map(asText).filter(Boolean).join(' '), copyrightType: asText(row.cpyrhtDivCd) || null }
  })
  return { items, totalCount: items.length, typeShare: distribution(items.map(item => item.category)), distributionBasis: 'content_count' as const, temporalBasis: 'fetchedAt' as const }
}
export async function getFestivals(client: KntoClient, district: DistrictSlug, ym: string, from: string) {
  const codes = regionCodes(district, ym, 'KorService2')
  const rows = uniqueContent(await client.all('KorService2/searchFestival2', { lDongRegnCd: codes.area, lDongSignguCd: codes.district, eventStartDate: from, arrange: 'A' }, 3600))
  return { from, temporalBasis: 'event_dates' as const, items: rows.map(row => ({ contentId: asText(row.contentid), title: asText(row.title), start: asText(row.eventstartdate), end: asText(row.eventenddate), place: asText(row.addr1), image: imageUrl(row.firstimage) })).sort((a, b) => a.start.localeCompare(b.start)) }
}
