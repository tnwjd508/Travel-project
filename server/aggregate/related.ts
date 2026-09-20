import { KntoClient, numeric, type Row } from '../knto.js'
import { regionCodes, type DistrictSlug } from '../regionCodes.js'
import { asText, distribution } from './contents.js'

export function aggregateRelated(rows: Row[]) {
  const links = new Map<string, Row>()
  for (const row of rows) {
    const hub = asText(row.tAtsCd); const related = asText(row.rlteTatsCd)
    if (hub && related) links.set(`${hub}:${related}`, row)
  }
  const grouped = new Map<string, { tAtsCd: string; name: string; relatedCount: number; top: { rank: number; name: string; category: string | null; district: string | null }[] }>()
  for (const row of links.values()) {
    const id = asText(row.tAtsCd)
    const hub = grouped.get(id) ?? { tAtsCd: id, name: asText(row.tAtsNm), relatedCount: 0, top: [] }
    hub.relatedCount++
    const rank = numeric(row.rlteRank)
    if (rank !== null) hub.top.push({ rank, name: asText(row.rlteTatsNm), category: asText(row.rlteCtgrySclsNm) || null, district: asText(row.rlteSignguNm) || null })
    grouped.set(id, hub)
  }
  // 화면에서 펼쳐 보여주는 연관 장소 수
  for (const hub of grouped.values()) hub.top = hub.top.sort((a, b) => a.rank - b.rank).slice(0, 5)
  const hubs = [...grouped.values()].map(hub => ({ ...hub, share: hub.relatedCount / links.size * 100 })).sort((a, b) => b.relatedCount - a.relatedCount || a.tAtsCd.localeCompare(b.tAtsCd))
  return { metric: 'related_link_share' as const, hubs, top3Share: hubs.length ? hubs.slice(0, 3).reduce((n, hub) => n + hub.share, 0) : null,
    categoryMix: distribution([...links.values()].map(row => asText(row.rlteCtgryMclsNm) || 'unknown')) }
}
export async function getRelated(client: KntoClient, district: DistrictSlug, ym: string) {
  const codes = regionCodes(district, ym, 'TarRlteTarService1')
  const rows = await client.all('TarRlteTarService1/areaBasedList1', { baseYm: ym, areaCd: codes.area, signguCd: codes.district })
  return aggregateRelated(rows.filter(row => asText(row.signguCd) === codes.district && asText(row.baseYm) === ym))
}
