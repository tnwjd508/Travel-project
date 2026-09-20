import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const migration = new URL('../supabase/migrations/20260920110556_tourism_api_response_cache.sql', import.meta.url)

test('관광 API 공통 캐시는 서버 전용이며 요청 해시 충돌과 잘못된 응답을 거부한다', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec('create role anon; create role authenticated; create role service_role;')
  await db.exec(await readFile(migration, 'utf8'))
  const operation = 'KorService2/areaCode2'
  const params = { numOfRows: '10', pageNo: '1' }
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(params).sort()))
  const digest = createHash('sha256').update(`v1\n${operation}\n${canonical}`).digest('hex')
  const payload = { items: [{ code: '1' }], totalCount: 1 }
  const fetchedAt = new Date(Date.now() - 60_000).toISOString()
  const rpc = async (name, args) => (await db.query(
    `select public.${name}(${Object.keys(args).map((key, index) => `${key} => $${index + 1}`).join(',')}) value`,
    Object.values(args).map(value => typeof value === 'object' ? JSON.stringify(value) : value),
  )).rows[0].value

  await db.exec('set role service_role')
  const stored = await rpc('tourism_cache_store', { p_request_sha256: digest, p_operation: operation,
    p_request_params: params, p_response_payload: payload, p_source_fetched_at: fetchedAt, p_schema_version: 1 })
  assert.equal(stored.state, 'stored')
  assert.deepEqual(stored.payload, payload)
  assert.deepEqual((await rpc('tourism_cache_get', { p_request_sha256: digest, p_operation: operation,
    p_request_params: params, p_schema_version: 1 })).payload, payload)
  await assert.rejects(rpc('tourism_cache_get', { p_request_sha256: digest, p_operation: 'KorService2/ldongCode2',
    p_request_params: params, p_schema_version: 1 }), /TOURISM_CACHE_KEY_CONFLICT/)
  await assert.rejects(rpc('tourism_cache_store', { p_request_sha256: 'a'.repeat(64), p_operation: operation,
    p_request_params: params, p_response_payload: { items: 'invalid', totalCount: 1 }, p_source_fetched_at: fetchedAt, p_schema_version: 1 }))

  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    await assert.rejects(rpc('tourism_cache_get', { p_request_sha256: digest, p_operation: operation,
      p_request_params: params, p_schema_version: 1 }), /permission denied/)
    await assert.rejects(db.query('select * from public.tourism_api_cache'), /permission denied/)
  }
})
