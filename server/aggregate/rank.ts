import { ApiError, KntoClient, numeric, type Row } from '../knto.js'
import { regionCodes, type DistrictSlug } from '../regionCodes.js'
import { indexDefinition } from './indices.js'

export function nationalAreas(ym: string, service: string) {
  const merged = ym >= (service === 'AreaTarResDemService' ? '202608' : '202607')
  return ['11', '26', '27', '28', '30', '31', '36', '41', '43', '44', '47', '48', '50', '51', '52', ...(merged ? ['12'] : ['29', '46'])]
}
export function rankRows(rows: Row[], field: string, code: string, ym: string, target: string) {
  const values = new Map<string, number>()
  for (const row of rows) {
    const id = String(row.signguCd ?? '')
    // Upstream includes a province aggregate with signguCd=0. It is not a district.
    if (!/^\d{5}$/.test(id) || String(row.baseYm) !== ym || String(row[`${field}Cd`]) !== code) continue
    const value = numeric(row[`${field}Val`])
    if (value !== null) {
      if (values.has(id) && values.get(id) !== value) throw new ApiError(502, 'DUPLICATE_INDEX', '전국 순위 지수가 중복되었습니다.')
      values.set(id, value)
    }
  }
  const value = values.get(target); const total = values.size
  const rank = value === undefined ? null : 1 + [...values.values()].filter(item => item > value).length
  // 시도 합계·중복을 제외한 동일 집합으로 평균과 중앙값을 계산합니다.
  const sorted = [...values.values()].sort((a, b) => a - b)
  const middle = Math.floor(total / 2)
  const mean = rank === null ? null : sorted.reduce((sum, item) => sum + item, 0) / total
  const median = rank === null ? null : total % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  return { rank, total, percentile: rank === null ? null : total === 1 ? 100 : (total - rank) / (total - 1) * 100,
    value: value ?? null, mean, median, tieCount: rank === null ? null : sorted.filter(item => item === value).length,
    topPct: rank === null ? null : rank / total * 100 }
}
export async function getRank(client: KntoClient, district: DistrictSlug, ym: string, code: string) {
  const { operation, field } = indexDefinition(code)
  const areas = nationalAreas(ym, operation.split('/')[0])
  const batches = await Promise.all(areas.map(async areaCd => ({ areaCd, rows: await client.all(operation, { baseYm: ym, areaCd, [`${field}Cd`]: code }) })))
  const missingAreas = batches.filter(batch => !batch.rows.some(row => /^\d{5}$/.test(String(row.signguCd)) && String(row.baseYm) === ym && String(row[`${field}Cd`]) === code && numeric(row[`${field}Val`]) !== null)).map(batch => batch.areaCd)
  const target = regionCodes(district, ym, operation.split('/')[0]).district
  const missingDistricts = [...new Set(batches.flatMap(batch => batch.rows.filter(row => /^\d{5}$/.test(String(row.signguCd)) && String(row.baseYm) === ym && String(row[`${field}Cd`]) === code && numeric(row[`${field}Val`]) === null).map(row => String(row.signguCd))))]
  const result = rankRows(batches.flatMap(batch => batch.rows), field, code, ym, target)
  const complete = missingAreas.length === 0 && missingDistricts.length === 0 && result.rank !== null
  return { ...result, ...(complete ? {} : { rank: null, percentile: null, topPct: null, mean: null, median: null, tieCount: null }), metric: code, complete, missingAreas, missingDistricts,
    scope: 'observed_nationwide_districts' as const, populationVerified: false as const }
}
