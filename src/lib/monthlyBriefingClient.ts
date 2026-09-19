import type { MonthlyBriefingData, BriefingStatusResponse } from '../types/briefing.js'
import { regionQuery, type RegionSelection } from '../data/tourismRegions.js'

export function waitForBriefing(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return }
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, milliseconds)
    signal.addEventListener('abort', abort, { once: true })
  })
}

// 최초 미생성 상태에서만 POST를 한 번 보냅니다. 이후의 대기는 GET 조회만 사용합니다.
export async function loadMonthlyBriefing(selection: RegionSelection, month: string, options: {
  signal: AbortSignal; allowCreate: boolean; fetcher?: typeof fetch;
  onGenerating?: () => void; wait?: typeof waitForBriefing;
}): Promise<{ data?: MonthlyBriefingData; error?: string }> {
  const fetcher = options.fetcher ?? fetch
  const query = regionQuery(selection)
  query.set('month', month)
  const url = `/api/monthly-briefing?${query}`
  let method = 'GET'
  let creationRequested = false
  for (let poll = 0; poll < 60; poll++) {
    options.signal.throwIfAborted()
    const response = await fetcher(url, { method, signal: options.signal, cache: 'no-store' })
    const payload = await response.json() as MonthlyBriefingData | BriefingStatusResponse
    if (response.status === 200 && 'district' in payload) {
      if (payload.district !== selection.district || payload.month !== month || !Array.isArray(payload.sources) || !payload.storage?.savedAt) throw new Error('저장된 브리핑 응답을 확인할 수 없습니다.')
      return { data: payload }
    }
    if (!('state' in payload)) throw new Error('브리핑 응답을 확인할 수 없습니다.')
    if (response.status === 404 && payload.code === 'NOT_GENERATED' && options.allowCreate && !creationRequested) {
      creationRequested = true
      method = 'POST'
      options.onGenerating?.()
      continue
    }
    if (response.status === 202 && payload.state === 'generating') {
      options.onGenerating?.()
      await (options.wait ?? waitForBriefing)(5000, options.signal)
      method = 'GET'
      continue
    }
    if (response.status === 409 && (payload.state === 'failed' || payload.state === 'interrupted')) {
      const snapshot = payload.snapshot
      if (snapshot && (snapshot.district !== selection.district || snapshot.month !== month)) throw new Error('지역 또는 월이 다른 응답입니다.')
      return { data: snapshot, error: payload.message }
    }
    throw new Error(payload.message || '월간 브리핑을 불러오지 못했습니다.')
  }
  throw new Error('브리핑 상태 확인 시간이 초과되었습니다. 저장 상태를 다시 조회해 주세요.')
}
