import { KntoClient, numeric } from '../knto.js'
import { regionCodes, type DistrictSlug } from '../regionCodes.js'
import { asText } from './contents.js'
import { shiftMonth } from './visitors.js'

// 중심 관광지는 매월 8일 갱신이고 통합 코드 전환 중 빈 달이 있어 이전 달까지 거슬러 찾는다.
export const HUB_LOOKBACK = 4

export async function getHubs(client: KntoClient, district: DistrictSlug, ym: string) {
  for (let offset = 0; offset < HUB_LOOKBACK; offset++) {
    const month = shiftMonth(ym, -offset)
    const codes = regionCodes(district, month, 'LocgoHubTarService1')
    const rows = (await client.all('LocgoHubTarService1/areaBasedList1', { baseYm: month, areaCd: codes.area, signguCd: codes.district }))
      .filter(row => asText(row.signguCd) === codes.district && asText(row.baseYm) === month)
    if (!rows.length) continue
    const items = rows
      .filter(row => numeric(row.hubRank) !== null)
      .map(row => ({ rank: Number(numeric(row.hubRank)), name: asText(row.hubTatsNm), category: asText(row.hubCtgryMclsNm) || null,
        lng: numeric(row.mapX), lat: numeric(row.mapY) }))
      .sort((a, b) => a.rank - b.rank)
    return { baseYm: month, metric: 'hub_link_centrality_rank' as const, items, totalCount: items.length }
  }
  return { baseYm: ym, metric: 'hub_link_centrality_rank' as const, items: [], totalCount: 0, missing: true as const }
}
