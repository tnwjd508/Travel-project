import { randomUUID } from 'node:crypto'
import type { MonthlyBriefingData, BriefingStatusResponse } from '../../src/types/briefing.js'
import { requireTourismDistrict } from '../../src/data/tourismRegions.js'
import { parseContext, type BriefingContext } from './data.js'
import { runBriefing } from './graph.js'

import { BriefingDatabaseError, checkedPayload, createSupabaseRepository, type DatabaseEnvironment, type BriefingRepository, type BriefingRecord } from './repository.js'

export interface BriefingEnvironment extends DatabaseEnvironment { TOUR_API_SERVICE_KEY?: string; GEMINI_API_KEY?: string; GEMINI_MODEL?: string }
export interface BriefingResponse { status: number; body: MonthlyBriefingData | BriefingStatusResponse }

function recordResponse(record: BriefingRecord, requestedDistrict: string): BriefingResponse {
  if (record.state === 'stored') return { status: 200, body: { ...record.data, district: requestedDistrict, storage: { savedAt: record.savedAt } } }
  if (record.state === 'missing') return { status: 404, body: { state: 'missing', code: 'NOT_GENERATED', message: '아직 저장된 월간 브리핑이 없습니다.' } }
  if (record.state === 'generating') return { status: 202, body: { state: 'generating', code: 'GENERATING', message: '월간 브리핑을 생성하고 있습니다.', retryAfter: 5 } }
  if (record.state === 'busy') return { status: 429, body: { state: 'busy', code: 'GENERATION_BUSY', message: '다른 지역의 브리핑을 생성 중입니다. 잠시 후 다시 접속해 주세요.' } }
  if (record.state === 'failed' || record.state === 'interrupted') return { status: 409, body: {
    state: record.state, code: record.errorCode,
    message: record.state === 'interrupted' ? '이 지역·월의 생성 작업이 중단되었습니다. 중복 생성을 막기 위해 자동 재실행하지 않습니다.' : '이 지역·월의 AI 생성에 실패했습니다. 확보한 자료는 보존하며 자동 재생성하지 않습니다.',
    ...(record.snapshot ? { snapshot: { ...record.snapshot, district: requestedDistrict } } : {}),
  } }
  throw new BriefingDatabaseError('DB_UNAVAILABLE')
}

// 실행 권한과 저장 결과의 기준은 DB입니다. 서버 메모리에는 월별 결과를 캐시하지 않습니다.
export function createBriefingService(
  environment: BriefingEnvironment,
  runner: (context: BriefingContext) => Promise<MonthlyBriefingData> = (context) => runBriefing(context, {
    serviceKey: environment.TOUR_API_SERVICE_KEY!, geminiKey: environment.GEMINI_API_KEY, model: environment.GEMINI_MODEL,
  }),
  repository: BriefingRepository = createSupabaseRepository(environment),
) {
  return async (method: string | undefined, query: URLSearchParams): Promise<BriefingResponse> => {
    if (method !== 'GET' && method !== 'POST') return { status: 405, body: { state: 'error', code: 'METHOD_NOT_ALLOWED', message: 'GET 또는 POST 요청만 지원합니다.' } }
    let context: BriefingContext
    try {
      for (const key of query.keys()) if (!['district', 'month', 'regionId'].includes(key) || query.getAll(key).length !== 1) throw new Error('알 수 없거나 중복된 파라미터입니다.')
      context = parseContext(query.get('district') ?? '', query.get('month'), undefined, query.get('regionId'))
    } catch (error) {
      return { status: 400, body: { state: 'error', code: 'INVALID_QUERY', message: error instanceof Error ? error.message : '조회 조건을 확인해 주세요.' } }
    }
    const district = requireTourismDistrict(context.district)
    const key = { regionId: district.regionId, districtId: district.id, month: context.month }
    try {
      // API 키가 없어도 이미 저장된 브리핑은 읽을 수 있습니다.
      const existing = await repository.get(key)
      if (method === 'GET' || existing.state !== 'missing') return recordResponse(existing, context.district)
      if (!environment.TOUR_API_SERVICE_KEY?.trim() || !environment.GEMINI_API_KEY?.trim()) return { status: 503, body: { state: 'error', code: 'AI_NOT_CONFIGURED', message: '새 브리핑 생성을 위한 관광 API 또는 Gemini 설정을 확인해 주세요.' } }
      const owner = randomUUID()
      const claim = await repository.claim(key, owner)
      if (claim.state !== 'claimed') return recordResponse(claim, context.district)
      let result: MonthlyBriefingData
      try {
        // 별칭 경로와 숫자 코드 경로도 같은 지역으로 생성·저장합니다.
        result = checkedPayload(await runner({ ...context, district: district.id }), key)
      } catch {
        return recordResponse(await repository.fail(key, owner, 'GENERATION_FAILED', null), context.district)
      }
      if (!result.diagnosis) return recordResponse(await repository.fail(key, owner, 'AI_UNAVAILABLE', result), context.district)
      // DB 저장 응답이 유실되면 저장만 재시도합니다. LangGraph는 다시 실행하지 않습니다.
      let saved: BriefingRecord
      try { saved = await repository.finish(key, owner, result, environment.GEMINI_MODEL || 'gemini-3.8-flash') }
      catch { saved = await repository.finish(key, owner, result, environment.GEMINI_MODEL || 'gemini-3.8-flash') }
      return recordResponse(saved, context.district)
    } catch (error) {
      const safeError = error instanceof BriefingDatabaseError ? error : new BriefingDatabaseError('DB_UNAVAILABLE')
      return { status: 503, body: { state: 'error', code: safeError.code, message: safeError.message } }
    }
  }
}
