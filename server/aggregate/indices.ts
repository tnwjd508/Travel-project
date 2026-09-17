import { ApiError, KntoClient, numeric, type Operation, type Row } from '../knto.js'
import { regionCodes, type DistrictSlug } from '../regionCodes.js'
import type { IndexGroup } from '../../src/types/district.js'

const children = (root: string, count: number) => [root, ...Array.from({ length: count }, (_, i) => `${root}${String(i + 1).padStart(2, '0')}`)]
export const INDEX_GROUPS: Record<IndexGroup, { operation: Operation; field: string; codes: string[] }> = {
  stay: { operation: 'AreaTarDemDsService/areaTarSjrnDsList', field: 'tarSjrnDsIx', codes: children('21', 5) },
  spend: { operation: 'AreaTarDemDsService/areaTarExpDsList', field: 'tarExpDsIx', codes: children('22', 3) },
  touristDiversity: { operation: 'AreaTarDivService/areaTouDivList', field: 'touDivIx', codes: children('31', 7) },
  spendDiversity: { operation: 'AreaTarDivService/areaExpDivList', field: 'expDivIx', codes: children('32', 7) },
  international: { operation: 'AreaTarDivService/areaIntlDivList', field: 'intlDivIx', codes: children('33', 3) },
  demand: { operation: 'AreaTarResDemService/areaTarSvcDemList', field: 'tarSvcDemIx', codes: children('11', 12) },
  culture: { operation: 'AreaTarResDemService/areaCulResDemList', field: 'culResDemIx', codes: children('12', 5) },
}
export function indexDefinition(code: string) {
  const found = Object.values(INDEX_GROUPS).find(group => group.codes.includes(code))
  if (!found) throw new ApiError(400, 'INVALID_METRIC', '지원하지 않는 지표입니다.')
  return found
}
export function matchingIndex(rows: Row[], field: string, code: string, ym: string, signguCd: string) {
  const matching = rows.filter(row => String(row.baseYm) === ym && String(row.signguCd) === signguCd && String(row[`${field}Cd`]) === code)
  if (matching.length > 1) throw new ApiError(502, 'DUPLICATE_INDEX', '지수 응답이 중복되었습니다.')
  return numeric(matching[0]?.[`${field}Val`])
}
export async function getIndex(client: KntoClient, district: DistrictSlug, ym: string, code: string) {
  const { operation, field } = indexDefinition(code)
  const region = regionCodes(district, ym, operation.split('/')[0])
  const rows = await client.all(operation, { baseYm: ym, areaCd: region.area, signguCd: region.district, [`${field}Cd`]: code })
  return matchingIndex(rows, field, code, ym, region.district)
}
export const DIAGNOSTIC_CODES = ['21', '22', '1109', '12', '1101', '1102', '1103', '1104', '33']
export async function getIndices(client: KntoClient, district: DistrictSlug, ym: string, selectedCodes?: string[]) {
  const entries = await Promise.all(Object.entries(INDEX_GROUPS).map(async ([group, definition]) => [group,
    Object.fromEntries(await Promise.all(definition.codes.filter(code => !selectedCodes || selectedCodes.includes(code)).map(async code => [code, await getIndex(client, district, ym, code)]))),
  ]))
  return Object.fromEntries(entries) as Record<IndexGroup, Record<string, number | null>>
}
