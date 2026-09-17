import type { MonthlyBriefingData } from '../../src/types/briefing.js'
import { parseContext, type BriefingContext } from './data.js'
import { runBriefing } from './graph.js'

export interface BriefingEnvironment { TOUR_API_SERVICE_KEY?: string; GEMINI_API_KEY?: string; GEMINI_MODEL?: string }
export interface BriefingResponse { status: number; body: MonthlyBriefingData | { message: string } }

// 메모리에는 공개 관광 자료만 보관합니다. 키와 사용자 정보는 캐시에 저장하지 않습니다.
export function createBriefingService(
  environment: BriefingEnvironment,
  runner: (context: BriefingContext) => Promise<MonthlyBriefingData> = (context) => runBriefing(context, {
    serviceKey: environment.TOUR_API_SERVICE_KEY!, geminiKey: environment.GEMINI_API_KEY, model: environment.GEMINI_MODEL,
  }),
  now: () => number = Date.now,
) {
  const cache = new Map<string, { expiresAt: number; result: MonthlyBriefingData }>()
  const running = new Map<string, Promise<MonthlyBriefingData>>()
  return async (method: string | undefined, query: URLSearchParams): Promise<BriefingResponse> => {
    if (method !== 'GET') return { status: 405, body: { message: 'GET 요청만 지원합니다.' } }
    let context: BriefingContext
    try {
      for (const key of query.keys()) if (!['district', 'month', 'regionId'].includes(key) || query.getAll(key).length !== 1) throw new Error('알 수 없거나 중복된 파라미터입니다.')
      context = parseContext(query.get('district') ?? '', query.get('month'), undefined, query.get('regionId'))
    } catch (error) {
      return { status: 400, body: { message: error instanceof Error ? error.message : '조회 조건을 확인해 주세요.' } }
    }
    if (!environment.TOUR_API_SERVICE_KEY?.trim()) return { status: 503, body: { message: '서버에 TOUR_API_SERVICE_KEY를 설정해 주세요.' } }
    const key = `${context.district}:${context.month}:${context.today}`
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now()) return { status: 200, body: cached.result }
    if (!running.has(key)) {
      if (running.size >= 2) return { status: 429, body: { message: '다른 월간 브리핑을 생성하고 있습니다. 잠시 후 다시 시도해 주세요.' } }
      const promise = runner(context).then((result) => {
        // 누락·실패한 결과는 짧게 보관하여 API 복구 후 다시 수집합니다.
        const healthy = result.aiStatus === 'ready' && result.sources.every((source) => source.status === 'ready')
        cache.set(key, { result, expiresAt: now() + (healthy ? 3_600_000 : 300_000) })
        if (cache.size > 32) cache.delete(cache.keys().next().value!)
        return result
      }).finally(() => running.delete(key))
      running.set(key, promise)
    }
    try { return { status: 200, body: await running.get(key)! } } catch {
      return { status: 502, body: { message: '월간 브리핑 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' } }
    }
  }
}
