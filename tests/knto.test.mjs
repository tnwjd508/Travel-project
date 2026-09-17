import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKntoUrl, parseKntoResponse, MemoCache, KntoClient, numeric } from '../.test-build/server/knto.js'
import { regionCodes } from '../.test-build/server/regionCodes.js'

const envelope = (items, totalCount = items.length) => JSON.stringify({ response: { header: { resultCode: '0000' }, body: { items: { item: items }, totalCount } } })
test('region migration, including resource-demand one-month exception', () => {
  assert.equal(regionCodes('namgu', '202606', 'DataLabService').district, '29155')
  assert.equal(regionCodes('namgu', '202607', 'DataLabService').district, '12270')
  assert.equal(regionCodes('donggu', '202607', 'AreaTarResDemService').district, '29110')
  assert.equal(regionCodes('donggu', '202608', 'AreaTarResDemService').district, '12210')
  assert.equal(regionCodes('gwangsangu', '202608', 'KorService2').district, '330')
})
test('fixed host and allowlist prevent key/host overrides; decode key once', () => {
  assert.equal(buildKntoUrl('KorService2/areaBasedList2', {}, 'a%2Bb%3D').searchParams.get('serviceKey'), 'a+b=')
  assert.throws(() => buildKntoUrl('https://evil.test', {}, 'secret'))
  assert.throws(() => buildKntoUrl('KorService2/areaBasedList2', { serviceKey: 'evil' }, 'secret'))
})
test('envelopes distinguish empty, singleton, malformed and upstream errors', () => {
  assert.deepEqual(parseKntoResponse(envelope({ title: 'one' }, 1)).items, [{ title: 'one' }])
  assert.deepEqual(parseKntoResponse(envelope([], 0)).items, [])
  assert.throws(() => parseKntoResponse(envelope([], 2)))
  assert.throws(() => parseKntoResponse('<returnReasonCode>22</returnReasonCode><secret>hidden</secret>'), e => e.status === 502 && e.resultCode === '22' && !e.message.includes('hidden'))
  assert.equal(numeric(''), null)
  assert.equal(numeric(null), null)
  assert.equal(numeric('72.15'), 72.15)
})
test('cache coalesces requests and evicts failures', async () => {
  const cache = new MemoCache(); let calls = 0
  const load = async () => { calls++; return 7 }
  assert.deepEqual(await Promise.all([cache.get('x', 100, load), cache.get('x', 100, load)]), [7, 7])
  assert.equal(calls, 1)
  await assert.rejects(cache.get('fail', 100, async () => { throw Error('failure') }))
  assert.equal(await cache.get('fail', 100, load), 7)
})
test('pagination follows actual returned row counts and fails on incomplete data', async () => {
  const client = new KntoClient('test', async url => new Response(envelope([{ id: new URL(url).searchParams.get('pageNo') }], 2)))
  assert.equal((await client.all('KorService2/areaBasedList2', {})).length, 2)
  const broken = new KntoClient('test', async () => new Response(envelope([], 2)))
  await assert.rejects(broken.all('KorService2/areaBasedList2', {}))
})

test('upstream transport errors redact URLs, keys and stacks from public messages', async () => {
  const client = new KntoClient('private-key', async () => { throw new Error('https://example.test/?serviceKey=private-key') })
  await assert.rejects(client.page('KorService2/areaBasedList2', {}), error => error.status === 502 && !error.message.includes('private-key') && !error.message.includes('example.test'))
})
