import { ApiError, KntoClient, withFreshness, withRequestBudget } from './knto.js'
import { DistrictService, districtConfig, parseDistrictQuery, RESOURCE_TTL, SOURCE } from './district.js'

export interface DistrictHttpRequest { method?: string; resource: string; params: URLSearchParams }
export interface DistrictHttpResult { status: number; headers: Record<string, string>; body: unknown }
let service: DistrictService | undefined
let currentKey: string | undefined
export async function handleDistrictHttp(request: DistrictHttpRequest, env: Record<string, string | undefined>, injectedService?: DistrictService): Promise<DistrictHttpResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  let baseYm: string | null = null
  try {
    if (request.method !== 'GET') { headers.Allow = 'GET'; throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'GET 요청만 지원합니다.') }
    const config = districtConfig(env)
    const query = parseDistrictQuery(request.resource, request.params, config)
    baseYm = query.baseYm
    const key = env.TOUR_API_SERVICE_KEY?.trim()
    if (!key) throw new ApiError(503, 'MISSING_KEY', 'TOUR_API_SERVICE_KEY 환경변수가 필요합니다.')
    if (!injectedService && (!service || currentKey !== key)) { service = new DistrictService(new KntoClient(key)); currentKey = key }
    const result = await withRequestBudget(() => withFreshness(() => (injectedService ?? service!).execute(query)))
    const seconds = Math.min(RESOURCE_TTL[query.resource], result.remainingSeconds)
    headers['Cache-Control'] = `public, max-age=0, s-maxage=${seconds}, must-revalidate`
    return { status: 200, headers, body: result.value }
  } catch (error) {
    const known = error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', '관광 데이터 처리 중 오류가 발생했습니다.')
    return { status: known.status, headers, body: { baseYm, source: SOURCE, fetchedAt: new Date().toISOString(), code: known.code, message: known.message, ...(known.resultCode ? { resultCode: known.resultCode } : {}) } }
  }
}
