import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const savedSchema = z.object({
  id: z.string().uuid(), organization_id: z.string().uuid(), created_by: z.string().uuid().nullable(),
  title: z.string(), region_id: z.string(), district_id: z.string().regex(/^\d{5}$/), district_name: z.string(),
  policy_code: z.enum(['night', 'festival', 'shuttle', 'market', 'art']), policy_name: z.string(),
  budget_krw: z.number().int().min(500000000).max(5000000000), start_month: z.string(),
  duration_months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
  briefing_month: z.string().nullable(), created_at: z.string(),
})
export type SavedScenario = z.infer<typeof savedSchema>
export const organizationsSchema = z.object({ organizations: z.array(z.object({
  id: z.string().uuid(), name: z.string(), role: z.enum(['admin', 'editor', 'viewer']),
})) })
export type Organization = z.infer<typeof organizationsSchema>['organizations'][number]
export const scenarioPageSchema = z.object({ items: z.array(savedSchema), nextCursor: z.string().nullable() })
export { savedSchema }

let clientPromise: Promise<SupabaseClient> | undefined
export function accountClient() {
  if (!clientPromise) clientPromise = (async () => {
    const response = await fetch('/api/account/config', { cache: 'no-store' })
    const config = await response.json()
    if (!response.ok) throw new Error(config.message || '공동 저장 설정을 확인하지 못했습니다.')
    if (typeof config.url !== 'string' || typeof config.publishableKey !== 'string' || !config.publishableKey.startsWith('sb_publishable_')) throw new Error('공동 저장 설정을 확인하지 못했습니다.')
    return createClient(config.url, config.publishableKey)
  })().catch(error => { clientPromise = undefined; throw error })
  return clientPromise
}

export async function scenarioRequest<T>(client: SupabaseClient, path: string, schema: z.ZodType<T>, options: RequestInit = {}) {
  const { data, error } = await client.auth.getSession()
  if (error || !data.session) throw new Error('기관 계정으로 로그인하세요.')
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${data.session.access_token}`)
  if (options.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...options, headers, cache: 'no-store' })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const message = z.object({ message: z.string() }).safeParse(payload)
    throw new Error(message.success ? message.data.message : '공동 저장 요청에 실패했습니다.')
  }
  const parsed = schema.safeParse(payload)
  if (!parsed.success) throw new Error('저장된 데이터 형식을 확인하지 못했습니다. 서비스 운영자에게 문의하세요.')
  return parsed.data
}
