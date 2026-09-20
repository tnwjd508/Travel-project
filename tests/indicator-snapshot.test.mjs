import test from 'node:test'
import assert from 'node:assert/strict'
import { captureIndicatorSnapshot } from '../.test-build/src/services/indicatorSnapshot.js'

const summary = { district: 'donggu', baseYm: '202608', stay: { ix21: 72.15 }, spend: { ix22: 70.32 }, demand: { ix11: 65.34 } }
const values = { '21': 72.15, '22': 70.32, '11': 65.34 }
function fixture(resource, query) {
  const metric = new URLSearchParams(query).get('metric')
  const meta = { district: '12210', baseYm: '202608' }
  return resource === 'rank' ? { ...meta, metric, value: values[metric], rank: 100, total: 256, mean: 80, median: 75 }
    : { ...meta, groups: { stay: { '21': 72.15 }, spend: { '22': 70.32 }, demand: { '11': 65.34 } } }
}

test('보고서 비교 자료는 같은 지역·기준월로 수집하고 원래 객체와 분리한다', async () => {
  const returned = []
  const snapshot = await captureIndicatorSnapshot(summary, 'gwangju', new AbortController().signal, async (resource, query) => {
    const params = new URLSearchParams(query)
    assert.equal(params.get('district'), 'donggu')
    assert.equal(params.get('baseYm'), '202608')
    assert.equal(params.get('regionId'), 'gwangju')
    const result = fixture(resource, query)
    returned.push(result)
    return result
  })
  assert.equal(returned.length, 4)
  assert.equal(snapshot.ranks['21'].value, 72.15)
  returned[0].value = 999
  assert.equal(snapshot.ranks['21'].value, 72.15)
  assert.equal(snapshot.indices.groups.demand['11'], 65.34)
})

test('지역·기준월·요약값이 다른 응답은 저장하지 않는다', async () => {
  for (const change of [data => ({ ...data, district: 'seogu' }), data => ({ ...data, baseYm: '202607' })]) {
    const result = await captureIndicatorSnapshot(summary, 'gwangju', new AbortController().signal, async (resource, query) => change(fixture(resource, query)))
    assert.deepEqual(result.ranks, { '21': null, '22': null, '11': null })
    assert.equal(result.indices, null)
  }
  const result = await captureIndicatorSnapshot(summary, 'gwangju', new AbortController().signal, async (resource, query) => {
    const data = fixture(resource, query)
    if (resource === 'rank') data.value = 999
    else data.groups.stay['21'] = 999
    return data
  })
  assert.equal(result.ranks['21'], null)
  assert.equal(result.indices, null)
})

test('일부 실패는 자료 없음으로 고정하고 조회 취소는 보고서를 만들지 않는다', async () => {
  const controller = new AbortController()
  const result = await captureIndicatorSnapshot(summary, 'gwangju', controller.signal, async (resource, query) => {
    if (resource === 'indices' || new URLSearchParams(query).get('metric') === '22') throw new Error('수집 실패')
    return fixture(resource, query)
  })
  assert.equal(result.ranks['22'], null)
  assert.equal(result.indices, null)
  assert.equal(result.ranks['11'].value, 65.34)
  controller.abort()
  await assert.rejects(() => captureIndicatorSnapshot(summary, 'gwangju', controller.signal, async (resource, query) => fixture(resource, query)), { name: 'AbortError' })
})
