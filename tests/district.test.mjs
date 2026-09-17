import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDistrictQuery, districtConfig } from '../.test-build/server/district.js'
import { handleDistrictHttp } from '../.test-build/server/districtHttp.js'
import { aggregateRelated } from '../.test-build/server/aggregate/related.js'
import { rankRows, nationalAreas } from '../.test-build/server/aggregate/rank.js'
import { MemoCache, withFreshness } from '../.test-build/server/knto.js'
import { diagnose } from '../.test-build/server/diagnosis.js'
import { INDEX_GROUPS } from '../.test-build/server/aggregate/indices.js'
import handler from '../.test-build/api/district/[resource].js'
const config = districtConfig({})
test('query rejects prototype names, duplicate values, invalid months and costly unbounded ranges', () => {
  const parse = (resource, query) => parseDistrictQuery(resource, new URLSearchParams(query), config)
  for (const [r, q] of [['__proto__',''], ['summary','district=constructor'], ['indices','baseYm=202613'], ['visitors','months=13'], ['summary','district=donggu&district=seogu'], ['festivals','from=20260230'], ['rank','metric=unknown'], ['contents','serviceKey=stolen']]) assert.throws(() => parse(r, q))
  assert.equal(parse('summary', 'district=all').district, 'all')
  assert.equal(parse('visitors', '').baseYm, '202607')
})
test('HTTP uses 503 for absent key, 405 with Allow, and no-store errors', async () => {
  const request = { method: 'GET', resource: 'summary', params: new URLSearchParams() }
  const result = await handleDistrictHttp(request, {})
  assert.equal(result.status, 503)
  assert.equal(result.headers['Cache-Control'], 'no-store')
  const post = await handleDistrictHttp({ ...request, method: 'POST' }, {})
  assert.equal(post.status, 405); assert.equal(post.headers.Allow, 'GET')
})
test('related links are unique; empty is unknown, not zero concentration', () => {
  const edge = { tAtsCd: 'a', tAtsNm: 'A', rlteTatsCd: 'b', rlteCtgryMclsNm: '문화' }
  assert.equal(aggregateRelated([edge, edge]).hubs[0].relatedCount, 1)
  assert.equal(aggregateRelated([]).top3Share, null)
})
test('national rank excludes province totals and uses competition ties', () => {
  const rows = [['0',100],['12210',70],['11110',80],['11120',70]].map(([signguCd,xVal]) => ({ signguCd, baseYm:'202608',xCd:'21',xVal }))
  const result = rankRows(rows,'x','21','202608','12210')
  assert.equal(result.total,3); assert.equal(result.rank,2)
  assert.equal(nationalAreas('202607','AreaTarResDemService').length,17)
  assert.equal(nationalAreas('202608','AreaTarResDemService').length,16)
})
test('nested cache and CDN cannot renew the source TTL', async () => {
  const source = new MemoCache(); const composite = new MemoCache()
  await source.get('one', 3, async () => 'data')
  const result = await withFreshness(() => composite.get('aggregate', 86400, () => source.get('one', 3, async () => 'bad')))
  assert.equal(result.value, 'data'); assert.ok(result.remainingSeconds <= 3)
})

test('diagnosis never manufactures a score or priorities from missing inputs', () => {
  const meta = { district: 'donggu', baseYm: '202608', source: '출처: ⓒ한국관광공사', fetchedAt: '2026-09-17T00:00:00.000Z', warnings: [] }
  const groups = Object.fromEntries(Object.entries(INDEX_GROUPS).map(([group, definition]) => [group, Object.fromEntries(definition.codes.map(code => [code, null]))]))
  const result = diagnose({ ...meta, age: { momPct: null }, stay: { ix2102: null }, spend: { ix22: null } }, { ...meta, groups }, { ...meta, top3Share: null }, { ...meta })
  assert.equal(result.activationIndex, null)
  assert.equal(result.priorities.length, 0)
  assert.equal(result.issues.length, 4)
  assert.ok(result.issues.every(issue => issue.status === 'unknown'))
  assert.equal(result.radar.length, 6)
  assert.equal(result.model.status, 'provisional')
})

test('production function adapter preserves duplicate query validation and HTTP headers', async () => {
  let status; let body; const headers = {}
  const response = { status(value) { status = value; return this }, setHeader(name, value) { headers[name] = value }, json(value) { body = value } }
  await handler({ method: 'GET', query: { resource: 'summary', district: ['donggu','seogu'] } }, response)
  assert.equal(status, 400); assert.equal(body.code, 'INVALID_PARAMETER')
  assert.equal(headers['Cache-Control'], 'no-store')
  await handler({ method: 'POST', query: { resource: 'contents' } }, response)
  assert.equal(status, 405); assert.equal(headers.Allow, 'GET')
})
