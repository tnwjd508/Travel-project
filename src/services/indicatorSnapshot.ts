import { requireTourismDistrict } from '../data/tourismRegions.js'
import type { IndicatorComparisonSnapshot, SummaryResponse } from '../types/district.js'
import { districtRequest } from './districtApi.js'

// 스냅샷의 기준월·지역이 다른 응답을 실수로 보고서에 섞지 않습니다.
export function matchesIndicatorSnapshot(data: { baseYm: string; district: string }, summary: SummaryResponse) {
  try {
    return data.baseYm === summary.baseYm && requireTourismDistrict(data.district).id === requireTourismDistrict(summary.district).id
  } catch { return false }
}

export async function captureIndicatorSnapshot(summary: SummaryResponse, regionId: string, signal: AbortSignal, request = districtRequest): Promise<IndicatorComparisonSnapshot> {
  const codes = ['21', '22', '11'] as const
  const own = { '21': summary.stay.ix21, '22': summary.spend.ix22, '11': summary.demand.ix11 }
  const query = (metric?: string) => new URLSearchParams({ regionId, district: summary.district, baseYm: summary.baseYm, ...(metric ? { metric } : {}) }).toString()
  // 한 API의 실패 때문에 기존 요약·진단 보고서까지 생성할 수 없게 만들지 않습니다.
  const [rankResults, detailResult] = await Promise.all([
    Promise.allSettled(codes.map(code => request('rank', query(code), signal))),
    Promise.allSettled([request('indices', query(), signal)]).then(results => results[0]),
  ])
  if (signal.aborted) throw new DOMException('보고서 생성을 취소했습니다.', 'AbortError')
  const snapshot: IndicatorComparisonSnapshot = { district: summary.district, baseYm: summary.baseYm, ranks: { '21': null, '22': null, '11': null }, indices: null }
  rankResults.forEach((result, index) => {
    const code = codes[index]
    if (result.status === 'fulfilled' && matchesIndicatorSnapshot(result.value, summary) && result.value.metric === code && result.value.value === own[code]) snapshot.ranks[code] = result.value
  })
  if (detailResult.status === 'fulfilled' && matchesIndicatorSnapshot(detailResult.value, summary)) {
    const groups = detailResult.value.groups
    // 조회 사이에 공급자의 값이 바뀌었다면 서로 다른 기준선을 합치지 않습니다.
    if (groups.stay?.['21'] === own['21'] && groups.spend?.['22'] === own['22'] && groups.demand?.['11'] === own['11']) snapshot.indices = detailResult.value
  }
  return structuredClone(snapshot)
}
