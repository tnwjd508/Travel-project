import test from 'node:test'
import assert from 'node:assert/strict'
import { KntoClient, withRequestBudget } from '../.test-build/server/knto.js'
import { DistrictService, parseDistrictQuery, districtConfig } from '../.test-build/server/district.js'
import { getRank } from '../.test-build/server/aggregate/rank.js'
import { INDEX_GROUPS } from '../.test-build/server/aggregate/indices.js'
import { diagnose } from '../.test-build/server/diagnosis.js'
import { sumVisitorRows, monthDays } from '../.test-build/server/aggregate/visitors.js'
const response = items => new Response(JSON.stringify({ response: { header: { resultCode: '0000' }, body: { items: { item: items }, totalCount: items.length } } }))

test('cold diagnosis uses at most 19 upstream calls', async () => {
  const urls = []
  const client = new KntoClient('bounded-diagnosis-test', async url => {
    const u = new URL(url); const p = u.searchParams; urls.push(u)
    if (u.pathname.includes('DataLabService')) return response([])
    if (u.pathname.includes('TarRlteTarService1')) return response([])
    const key = [...p.keys()].find(name => name.endsWith('IxCd'))
    return response([{ baseYm: p.get('baseYm'), signguCd: p.get('signguCd'), [key]: p.get(key), [key.replace(/Cd$/, 'Val')]: '100' }])
  })
  const service = new DistrictService(client)
  const result = await withRequestBudget(() => service.execute(parseDistrictQuery('diagnosis', new URLSearchParams(), districtConfig({}))))
  assert.equal(urls.length, 19)
  assert.equal(result.activationIndex, 100)
  assert.ok(urls.every(url => !url.pathname.includes('areaTarSjrnDsList') || url.searchParams.has('signguCd')))
})

test('request call budget stops additional fetches rather than silently truncating', async () => {
  let calls = 0
  const client = new KntoClient('budget-test', async () => { calls++; return response([]) })
  await assert.rejects(withRequestBudget(async () => {
    for (let i = 1; i <= 3; i++) await client.page('KorService2/areaBasedList2', { pageNo: String(i) })
  }, 2), error => error.code === 'REQUEST_BUDGET' && error.status === 503)
  assert.equal(calls, 2)
})

test('concurrency permits never exceed six during queued work', async () => {
  let active = 0; let maximum = 0
  const client = new KntoClient('concurrency-test', async () => {
    active++; maximum = Math.max(maximum, active)
    await new Promise(resolve => setTimeout(resolve, 2))
    active--; return response([])
  })
  await Promise.all(Array.from({ length: 20 }, (_, i) => client.page('KorService2/areaBasedList2', { pageNo: String(i) })))
  assert.equal(maximum, 6)
})

test('deadline cancels queued and active work without leaking permits', async () => {
  let hanging = true; let calls = 0
  const client = new KntoClient('deadline-test', async (_url, options) => {
    calls++
    if (!hanging) return response([])
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(response([])), 1000)
      options.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')) }, { once: true })
    })
  })
  const results = await withRequestBudget(() => Promise.allSettled(Array.from({ length: 10 }, (_, i) => client.page('KorService2/areaBasedList2', { pageNo: String(i) }))), 80, 10)
  assert.ok(results.every(result => result.status === 'rejected'))
  assert.ok(results.every(result => result.reason.code === 'REQUEST_TIMEOUT'))
  assert.equal(calls, 6)
  hanging = false
  await withRequestBudget(() => Promise.all(Array.from({ length: 10 }, (_, i) => client.page('KorService2/areaBasedList2', { pageNo: String(i) }))))
  assert.equal(calls, 16)
})

test('rank fails closed for an explicitly missing district even if every province has data', async () => {
  const client = new KntoClient('rank-null-test', async url => {
    const p = new URL(url).searchParams; const area = p.get('areaCd')
    return response([
      { baseYm: '202608', signguCd: area === '12' ? '12210' : `${area}110`, tarSjrnDsIxCd: '21', tarSjrnDsIxVal: '80' },
      ...(area === '11' ? [{ baseYm: '202608', signguCd: '11120', tarSjrnDsIxCd: '21', tarSjrnDsIxVal: '' }] : []),
    ])
  })
  const rank = await getRank(client, 'donggu', '202608', '21')
  assert.equal(rank.complete, false); assert.equal(rank.rank, null)
  assert.deepEqual(rank.missingDistricts, ['11120'])
  assert.equal(rank.populationVerified, false)
})

test('one missing day suppresses monthly totals; full month retains actual sum', () => {
  const rows = Array.from({ length: monthDays('202607') }, (_, i) => ['1','2','3'].map(touDivCd => ({ signguCode: '12210', baseYmd: `202607${String(i+1).padStart(2,'0')}`, touDivCd, touNum: '10' }))).flat()
  assert.equal(sumVisitorRows(rows.slice(0,-3),'donggu','202607').total, null)
  assert.equal(sumVisitorRows(rows,'donggu','202607').total, 930)
})

test('normal indicators produce no improvement priorities', () => {
  const meta = { district: 'donggu', baseYm: '202608', source: '출처: ⓒ한국관광공사', fetchedAt: '2026-09-17T00:00:00.000Z', warnings: [] }
  const groups = Object.fromEntries(Object.entries(INDEX_GROUPS).map(([group, definition]) => [group, Object.fromEntries(definition.codes.map(code => [code, 100]))]))
  const result = diagnose({ ...meta, age: { momPct: 0 }, stay: { ix2102: 100 }, spend: { ix22: 100 } }, { ...meta, groups }, { ...meta, top3Share: 20 })
  assert.equal(result.priorities.length, 0)
  assert.ok(result.issues.every(issue => issue.status === 'normal'))
})
