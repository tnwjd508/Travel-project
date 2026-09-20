import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createTourismApiCache, tourismCacheKey } from '../.test-build/server/tourismCache.js'

test('Python과 Node 관광 API 캐시는 같은 비밀키 없는 요청 해시를 사용한다', () => {
  const operation = 'KorService2/areaCode2'
  const params = { pageNo: '1', numOfRows: '10' }
  const canonical = JSON.stringify({ numOfRows: '10', pageNo: '1' })
  assert.equal(tourismCacheKey(operation, params), createHash('sha256').update(`v1\n${operation}\n${canonical}`).digest('hex'))
})

test('Node 월간 브리핑 캐시는 서버 RPC에서 검증된 페이지만 읽고 쓴다', async () => {
  const calls = []
  const cache = createTourismApiCache({ SUPABASE_URL: 'https://database.example', SUPABASE_SECRET_KEY: 'sb_secret_test' }, async (input, init) => {
    const url = new URL(String(input)); const body = JSON.parse(init.body); calls.push({ url, body, headers: init.headers })
    if (url.pathname.endsWith('tourism_cache_get')) return Response.json({ state: 'stored', payload: { items: [{ id: '1' }], totalCount: 1 }, fetchedAt: new Date().toISOString() })
    return Response.json({ state: 'stored', payload: body.p_response_payload, fetchedAt: body.p_source_fetched_at })
  })
  const value = await cache.get('KorService2/areaCode2', { pageNo: '1' })
  assert.deepEqual(value.rows, [{ id: '1' }]); assert.equal(value.total, 1)
  await cache.store('KorService2/areaCode2', { pageNo: '1' }, { rows: [{ id: '2' }], total: 1 })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].headers.apikey, 'sb_secret_test')
  assert.equal(calls[1].body.p_response_payload.items[0].id, '2')
  assert.doesNotMatch(JSON.stringify(calls.map(call => call.body)), /sb_secret_test/)
})
