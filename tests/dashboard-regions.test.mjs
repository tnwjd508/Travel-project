import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveDashboardRegion } from '../.test-build/src/data/dashboardRegions.js'
import { tourismProvinces, districtsForRegion } from '../.test-build/src/data/tourismRegions.js'
import { geoArea, geoMercator, geoPath } from 'd3-geo'

test('동명 자치구도 선택한 시도의 대시보드·재선택·API 경로를 유지한다', () => {
  const seoul = resolveDashboardRegion('seoul', '11140')
  const busan = resolveDashboardRegion('busan', '26110')
  assert.equal(seoul.nameKo, '중구')
  assert.equal(busan.nameKo, '중구')
  assert.equal(seoul.dashboardPath, '/dashboard/seoul/11140/overview')
  assert.equal(busan.dashboardPath, '/dashboard/busan/26110/overview')
  assert.equal(seoul.selectionPath, '/regions/seoul')
  assert.deepEqual(seoul.selection, { regionId: 'seoul', district: '11140' })
  assert.equal(seoul.legacy, null)
  assert.equal(resolveDashboardRegion('seoul', '26110'), null)
  assert.equal(resolveDashboardRegion('seoul', 'donggu'), null)
  assert.equal(resolveDashboardRegion('unknown', '11110'), null)
})

test('광주의 기존 별칭 및 전국 코드 모두 같은 기존 대시보드로 연결된다', () => {
  const old = resolveDashboardRegion('gwangju', 'gwangsangu')
  const canonical = resolveDashboardRegion('gwangju', '12330')
  assert.equal(old.dashboardPath, '/dashboard/gwangju/gwangsangu/overview')
  assert.deepEqual(old, canonical)
  assert.equal(old.legacy.slug, 'gwangsangu')
})

test('서울 등 지도에서 선택 가능한 모든 경계는 해당 시도의 관광 API 코드에 연결된다', () => {
  const expected = { seoul: 25, busan: 16, daegu: 9, jeju: 2, sejong: 1 }
  for (const region of tourismProvinces) {
    const map = JSON.parse(readFileSync(`public/maps/${region.id}.json`, 'utf8'))
    const allowed = new Set(districtsForRegion(region.id).map(d => d.id))
    const mapped = map.features.filter(f => f.properties.districtId)
    if (expected[region.id]) assert.equal(mapped.length, expected[region.id])
    assert.equal(new Set(mapped.map(f => f.properties.districtId)).size, mapped.length)
    const path = geoPath(geoMercator().fitExtent([[32, 65], [768, 525]], map))
    for (const feature of map.features) {
      if (feature.properties.districtId) {
        assert.ok(allowed.has(feature.properties.districtId))
        assert.ok(resolveDashboardRegion(region.id, feature.properties.districtId))
      }
      assert.ok(geoArea(feature) < 2 * Math.PI, '경계 방향 오류로 세계 전체를 채우지 않아야 합니다.')
      assert.doesNotMatch(path(feature), /NaN|Infinity/)
    }
  }
})

test('개편 전 인천 경계를 현재 신설 구의 경계로 오인하여 연결하지 않는다', () => {
  const map = JSON.parse(readFileSync('public/maps/incheon.json', 'utf8'))
  for (const name of ['중구', '동구', '서구']) assert.equal(map.features.find(f => f.properties.name === name).properties.districtId, null)
  assert.ok(districtsForRegion('incheon').some(d => d.name === '검단구'))
})
