import test from 'node:test'
import assert from 'node:assert/strict'
import { sumVisitorRows, shiftMonth, changePct } from '../.test-build/server/aggregate/visitors.js'
import { INDEX_GROUPS, matchingIndex } from '../.test-build/server/aggregate/indices.js'
import { distribution, imageUrl } from '../.test-build/server/aggregate/contents.js'
test('month arithmetic crosses years and percent handles missing/zero baseline', () => {
  assert.equal(shiftMonth('202601', -1), '202512')
  assert.equal(shiftMonth('202608', -12), '202508')
  assert.equal(changePct(10, 0), null)
  assert.equal(changePct(90, 100), -10)
})
test('visitor aggregation filters district, deduplicates dates, tracks incomplete months', () => {
  const rows = ['1', '2', '3'].map(touDivCd => ({ signguCode: '12210', baseYmd: '20260701', touDivCd, touNum: '10.5' }))
  const result = sumVisitorRows([...rows, rows[0], { ...rows[0], signguCode: '11110', touNum: '90000' }], 'donggu', '202607')
  assert.equal(result.total, null)
  assert.equal(result.local, null)
  assert.equal(result.complete, false)
  assert.equal(result.observedDays, 1)
  assert.equal(sumVisitorRows([], 'donggu', '202607').total, null)
  assert.throws(() => sumVisitorRows([rows[0], { ...rows[0], touNum: '3' }], 'donggu', '202607'))
})
test('all 49 index codes are configured; wrong month/region never masquerades as a value', () => {
  assert.equal(Object.values(INDEX_GROUPS).reduce((n, g) => n + g.codes.length, 0), 49)
  assert.equal(matchingIndex([{ baseYm: '202607', signguCd: '12210', xCd: '21', xVal: '9' }], 'x', '21', '202608', '12210'), null)
})
test('content shares are actual counts, and active URL schemes are dropped', () => {
  assert.ok(Math.abs(distribution(['A', 'A', 'B'])[0].pct - 200 / 3) < 1e-10)
  assert.equal(imageUrl('javascript:alert(1)'), null)
})
