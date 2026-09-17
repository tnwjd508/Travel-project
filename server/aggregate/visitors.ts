import { ApiError, KntoClient, MemoCache, numeric, type Row } from '../knto.js'
import { DISTRICTS, regionCodes, type DistrictSlug } from '../regionCodes.js'
import type { VisitorMonth } from '../../src/types/district.js'

export function shiftMonth(ym: string, offset: number): string {
  const date = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4)) - 1 + offset, 1))
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
export function monthDays(ym: string) { return new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4)), 0)).getUTCDate() }
export function sumVisitorRows(rows: Row[], district: DistrictSlug, ym: string): VisitorMonth {
  const code = regionCodes(district, ym, 'DataLabService').district
  const days = new Set<string>(); const seen = new Map<string, number>(); const sums = [0, 0, 0]; const counts = [0, 0, 0]
  for (const row of rows) {
    if (String(row.signguCode) !== code) continue
    const date = String(row.baseYmd); const div = String(row.touDivCd)
    if (!/^[123]$/.test(div)) continue
    if (!/^\d{8}$/.test(date) || date.slice(0, 6) !== ym || +date.slice(6) < 1 || +date.slice(6) > monthDays(ym)) throw new ApiError(502, 'INVALID_VISITOR_DATE', '방문자 기준일이 조회 범위와 다릅니다.')
    const value = numeric(row.touNum)
    if (value === null || value < 0) continue
    const id = `${date}:${div}`
    if (seen.has(id)) {
      if (seen.get(id) !== value) throw new ApiError(502, 'DUPLICATE_DATA', '중복 방문자 데이터 값이 일치하지 않습니다.')
      continue
    }
    seen.set(id, value); days.add(date); sums[+div - 1] += value; counts[+div - 1]++
  }
  const expectedDays = monthDays(ym)
  const complete = counts.every(c => c === expectedDays)
  const values = sums.map(value => complete ? Math.round(value * 100) / 100 : null)
  return { ym, total: complete ? Math.round(sums.reduce((a, b) => a + b, 0) * 100) / 100 : null,
    local: values[0], outside: values[1], foreign: values[2], complete,
    observedDays: days.size, expectedDays, through: [...days].sort().at(-1) ?? null }
}
const monthCache = new MemoCache(60)
export async function visitorMonth(client: KntoClient, district: DistrictSlug, ym: string) {
  const all = await monthCache.get(`${client.scope}:${ym}`, 86400, async () => {
    // Keep only five district aggregates in memory, not nationwide daily records.
    const rows = await client.all('DataLabService/locgoRegnVisitrDDList', { startYmd: `${ym}01`, endYmd: `${ym}${monthDays(ym)}` }, 0, 30000)
    return Object.fromEntries(Object.keys(DISTRICTS).map(slug => [slug, sumVisitorRows(rows, slug as DistrictSlug, ym)]))
  })
  return all[district]
}
export function changePct(current: number | null, previous: number | null): number | null {
  return current === null || previous === null || previous === 0 ? null : Math.round((current - previous) / previous * 10000) / 100
}
