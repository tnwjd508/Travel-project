import { loadEnv } from 'vite'
import { collectAll, parseContext } from '../server/briefing/data.js'
import { runBriefing } from '../server/briefing/graph.js'

// 인증키와 원문 응답은 출력하지 않고 API별 상태만 확인합니다.
const env = loadEnv('development', process.cwd(), ['TOUR_', 'GEMINI_'])
if (!env.TOUR_API_SERVICE_KEY) throw new Error('.env.local에 TOUR_API_SERVICE_KEY를 설정해 주세요.')
const context = parseContext(process.argv[2] ?? 'donggu', process.argv[3] ?? null)
// 필터 문제를 조사할 때에도 키·URL·상세 주소는 출력하지 않습니다.
const inspectFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init)
  const payload = await response.clone().json() as { response?: { body?: { totalCount?: number; items?: { item?: Record<string, unknown>[] } } } }
  const body = payload.response?.body
  console.log(JSON.stringify({ operation: new URL(String(input)).pathname, total: body?.totalCount,
    regions: body?.items?.item?.slice(0, 2).map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => /^(lDong|ldong|area|sigungu|signgu|baseYm|event)/.test(key)))),
  }))
  return response
}
const result = await runBriefing(context, {
  serviceKey: env.TOUR_API_SERVICE_KEY,
  // 기본 점검은 관광 API만 호출합니다. --with-gemini를 붙일 때만 유료 모델을 호출합니다.
  geminiKey: process.argv.includes('--with-gemini') ? env.GEMINI_API_KEY : undefined,
  model: env.GEMINI_MODEL,
  ...(process.argv.includes('--inspect') ? { dependencies: { collect: (ctx: typeof context, signal: AbortSignal) => collectAll(ctx, env.TOUR_API_SERVICE_KEY, signal, inspectFetch) } } : {}),
})
console.log(JSON.stringify({
  district: result.district, month: result.month, aiStatus: result.aiStatus,
  sources: result.sources, evidenceCount: result.evidence.length,
  recentFestivals: result.festivals.recent.map((item) => item.title),
  upcomingFestivals: result.festivals.upcoming.map((item) => item.title),
  steps: result.steps,
}, null, 2))
