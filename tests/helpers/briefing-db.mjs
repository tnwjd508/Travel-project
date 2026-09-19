import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { createSupabaseRepository } from '../../.test-build/server/briefing/repository.js'

export const testEnv = { SUPABASE_URL: 'https://database.example', SUPABASE_SECRET_KEY: 'sb_secret_test', TOUR_API_SERVICE_KEY: 'test-tour', GEMINI_API_KEY: 'test-gemini' }

// 실제 PostgreSQL 엔진에 운영 SQL을 그대로 적용하고 HTTP 전송 부분만 로컬로 연결합니다.
export async function createTestDatabase() {
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role;')
  for (const file of ['001_monthly_briefings.sql', '002_monthly_briefing_jobs.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  }
  const month = (await db.query("select to_char(date_trunc('month', timezone('Asia/Seoul', now())) - interval '1 month', 'YYYY-MM') as month")).rows[0].month
  const rpc = async (name, args) => {
    if (!['briefing_get', 'briefing_claim', 'briefing_finish', 'briefing_fail'].includes(name)) throw new Error('허용하지 않은 함수')
    const keys = Object.keys(args)
    if (keys.some(key => !/^p_[a-z_]+$/.test(key))) throw new Error('허용하지 않은 인수')
    const values = Object.values(args).map(value => typeof value === 'object' && value !== null ? JSON.stringify(value) : value)
    return (await db.query(`select public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')}) as result`, values)).rows[0].result
  }
  const fetcher = async (input, init) => Response.json(await rpc(new URL(String(input)).pathname.split('/').pop(), JSON.parse(init.body)))
  return { db, month, rpc, fetcher, repository: createSupabaseRepository(testEnv, fetcher) }
}

export function fixture(context, status = 'ready') {
  const id = 'source:1'
  return {
    district: context.district, districtName: '검증 지역', month: context.month,
    generatedAt: new Date().toISOString(), festivalAsOf: context.today ?? new Date().toISOString().slice(0, 10),
    aiStatus: status,
    diagnosis: status === 'unavailable' ? null : { summary: '검증용 공개 자료 요약입니다.', summaryEvidenceIds: [id], findings: [{ title: '수집된 자료', description: '확인된 근거를 분석했습니다.', evidenceIds: [id] }], recommendations: [], limitations: [] },
    evidence: [{ id, sourceId: 'source', label: '검증 자료', value: '75', period: context.month, note: '' }],
    sources: [{ id: 'source', label: '검증 자료', endpoint: 'test', status: 'ready', count: 1, note: '' }],
    festivals: { recent: [], upcoming: [] }, steps: [{ sourceId: 'source', status: status === 'unavailable' ? 'failed' : 'merged' }], warnings: [],
  }
}
