import { KntoClient, type Row } from '../knto.js'
import { regionCodes, type DistrictSlug } from '../regionCodes.js'
import { asText, distribution } from './contents.js'

export function aggregateRelated(rows: Row[]) {
  const links = new Map<string, Row>()
  for (const row of rows) {
    const hub = asText(row.tAtsCd); const related = asText(row.rlteTatsCd)
    if (hub && related) links.set(`${hub}:${related}`, row)
  }
  const grouped = new Map<string, { tAtsCd: string; name: string; relatedCount: number }>()
  for (const row of links.values()) {
    const id = asText(row.tAtsCd)
    const hub = grouped.get(id) ?? { tAtsCd: id, name: asText(row.tAtsNm), relatedCount: 0 }
    hub.relatedCount++; grouped.set(id, hub)
  }
  const hubs = [...grouped.values()].map(hub => ({ ...hub, share: hub.relatedCount / links.size * 100 })).sort((a, b) => b.relatedCount - a.relatedCount || a.tAtsCd.localeCompare(b.tAtsCd))
  return { metric: 'related_link_share' as const, hubs, top3Share: hubs.length ? hubs.slice(0, 3).reduce((n, hub) => n + hub.share, 0) : null,
    categoryMix: distribution([...links.values()].map(row => asText(row.rlteCtgryMclsNm) || 'unknown')) }
}
export async function getRelated(client: KntoClient, district: DistrictSlug, ym: string) {
  const codes = regionCodes(district, ym, 'TarRlteTarService1')
  const rows = await client.all('TarRlteTarService1/areaBasedList1', { baseYm: ym, areaCd: codes.area, signguCd: codes.district })
  return aggregateRelated(rows.filter(row => asText(row.signguCd) === codes.district && asText(row.baseYm) === ym))
}
