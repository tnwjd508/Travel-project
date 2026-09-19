import { z } from 'zod'
import type { MonthlyBriefingData } from '../../src/types/briefing.js'
import { diagnosisSchema, validateDiagnosis } from './graph.js'

export interface BriefingKey { regionId: string; districtId: string; month: string }
export interface DatabaseEnvironment { SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string }
export class BriefingDatabaseError extends Error {
  constructor(readonly code: 'DB_NOT_CONFIGURED' | 'DB_UNAVAILABLE') {
    super(code === 'DB_NOT_CONFIGURED' ? '월간 브리핑 저장소 연결이 아직 설정되지 않았습니다.' : '월간 브리핑 저장소에 연결하지 못했습니다. 새 분석은 실행하지 않습니다.')
  }
}

// 저장·조회 모두 같은 형식 검사를 거치고 알 수 없는 추가 필드는 제거합니다.
const festivalSchema = z.object({ id: z.string(), title: z.string(), address: z.string(), startDate: z.string(), endDate: z.string() })
export const briefingPayloadSchema = z.object({
  district: z.string(), districtName: z.string(), month: z.string().regex(/^\d{4}-\d{2}$/),
  generatedAt: z.string().datetime(), festivalAsOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  aiStatus: z.enum(['ready', 'partial', 'unavailable']), diagnosis: diagnosisSchema.nullable(),
  evidence: z.array(z.object({ id: z.string(), sourceId: z.string(), label: z.string(), value: z.string(), period: z.string(), note: z.string() })),
  sources: z.array(z.object({ id: z.string(), label: z.string(), endpoint: z.string(), status: z.enum(['ready', 'empty', 'partial', 'error']), count: z.number(), note: z.string() })),
  festivals: z.object({ recent: z.array(festivalSchema), upcoming: z.array(festivalSchema) }),
  steps: z.array(z.object({ sourceId: z.string(), status: z.enum(['merged', 'skipped', 'failed']) })),
  warnings: z.array(z.string()),
})
export function checkedPayload(value: unknown, key: BriefingKey): MonthlyBriefingData {
  const data = briefingPayloadSchema.parse(value)
  if (data.district !== key.districtId || data.month !== key.month) throw new Error('브리핑 지역 또는 월이 일치하지 않습니다.')
  if (data.diagnosis) validateDiagnosis(data.diagnosis, data.evidence)
  if ((data.aiStatus === 'unavailable') !== (data.diagnosis === null)) throw new Error('AI 분석 상태가 일치하지 않습니다.')
  return data
}

const stateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('stored'), data: briefingPayloadSchema, savedAt: z.string() }),
  z.object({ state: z.enum(['missing', 'generating', 'claimed', 'busy']) }),
  z.object({ state: z.enum(['failed', 'interrupted']), errorCode: z.enum(['AI_UNAVAILABLE', 'GENERATION_FAILED', 'INTERRUPTED']), snapshot: briefingPayloadSchema.nullable() }),
])
export type BriefingRecord = z.infer<typeof stateSchema>
export interface BriefingRepository {
  get(key: BriefingKey): Promise<BriefingRecord>
  claim(key: BriefingKey, owner: string): Promise<BriefingRecord>
  finish(key: BriefingKey, owner: string, data: MonthlyBriefingData, model: string): Promise<BriefingRecord>
  fail(key: BriefingKey, owner: string, code: 'AI_UNAVAILABLE' | 'GENERATION_FAILED', snapshot: MonthlyBriefingData | null): Promise<BriefingRecord>
}

export function createSupabaseRepository(environment: DatabaseEnvironment, fetcher: typeof fetch = fetch): BriefingRepository {
  const rpc = async (name: string, key: BriefingKey, extra: Record<string, unknown> = {}): Promise<BriefingRecord> => {
    const secret = environment.SUPABASE_SECRET_KEY?.trim() || environment.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!environment.SUPABASE_URL?.trim() || !secret) throw new BriefingDatabaseError('DB_NOT_CONFIGURED')
    try {
      const base = new URL(environment.SUPABASE_URL)
      if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('잘못된 DB 주소')
      const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: secret }
      // 새 secret 키는 JWT가 아닙니다. 기존 service_role JWT만 Authorization에도 사용합니다.
      if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`
      const response = await fetcher(new URL(`/rest/v1/rpc/${name}`, base), {
        method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ p_region_id: key.regionId, p_district_id: key.districtId, p_month: `${key.month}-01`, ...extra }),
      })
      if (!response.ok) throw new Error('DB 요청 실패')
      const record = stateSchema.parse(await response.json())
      if (record.state === 'stored') {
        checkedPayload(record.data, key)
        if (!record.data.diagnosis || !Number.isFinite(Date.parse(record.savedAt))) throw new Error('저장 결과 확인 필요')
      }
      if ((record.state === 'failed' || record.state === 'interrupted') && record.snapshot) checkedPayload(record.snapshot, key)
      return record
    } catch {
      // URL, 키, SQL 및 Supabase 오류 원문은 외부로 전달하지 않습니다.
      throw new BriefingDatabaseError('DB_UNAVAILABLE')
    }
  }
  return {
    get: key => rpc('briefing_get', key),
    claim: (key, owner) => rpc('briefing_claim', key, { p_owner_token: owner }),
    finish: (key, owner, data, model) => rpc('briefing_finish', key, { p_owner_token: owner, p_payload: checkedPayload(data, key), p_model: model }),
    fail: (key, owner, code, snapshot) => rpc('briefing_fail', key, { p_owner_token: owner, p_error_code: code, p_snapshot: snapshot ? checkedPayload(snapshot, key) : null }),
  }
}
