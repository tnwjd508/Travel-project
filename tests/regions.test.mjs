import test from 'node:test'
import assert from 'node:assert/strict'
import { tourismProvinces, tourismDistricts, requireTourismDistrict, districtsForRegion, regionQuery } from '../.test-build/src/data/tourismRegions.js'
import { regionCodes } from '../.test-build/server/regionCodes.js'
import { parseDistrictQuery, districtConfig } from '../.test-build/server/district.js'
import { visitorMonth } from '../.test-build/server/aggregate/visitors.js'
import { collectSource, sourceSpecs, parseContext } from '../.test-build/server/briefing/data.js'
import { createBriefingService } from '../.test-build/server/briefing/service.js'
import { handleRegions } from '../.test-build/server/regions.js'

const config = districtConfig({})
const envelope = rows => Response.json({ response: { header: { resultCode: '0000' }, body: { items: { item: rows }, totalCount: rows.length } } })

test('전국 목록의 코드는 유일하며 실제 시도에 속하고 동명 자치구를 구분한다', () => {
  assert.equal(tourismProvinces.length, 16)
  assert.equal(tourismDistricts.length, 269)
  assert.equal(new Set(tourismDistricts.map(d => d.id)).size, tourismDistricts.length)
  for (const district of tourismDistricts) {
    assert.match(district.id, /^\d{5}$/)
    assert.ok(tourismProvinces.some(p => p.id === district.regionId))
    assert.equal(requireTourismDistrict(district.id, district.regionId), district)
  }
  assert.equal(requireTourismDistrict('11140', 'seoul').name, '중구')
  assert.equal(requireTourismDistrict('26110', 'busan').name, '중구')
  assert.throws(() => requireTourismDistrict('26110', 'seoul'))
  assert.throws(() => requireTourismDistrict('중구'))
  assert.throws(() => requireTourismDistrict('__proto__'))
  assert.equal(districtsForRegion('gwangju').length, 5)
  assert.equal(requireTourismDistrict('gwangsangu', 'gwangju').id, '12330')
})

test('세종의 관광 코드와 통계 코드를 구분하고 개편 전 코드 및 수요 지표의 예외를 적용한다', () => {
  assert.deepEqual(regionCodes('36110', '202608', 'KorService2'), { area: '36110', district: '36110' })
  assert.deepEqual(regionCodes('36110', '202608', 'DataLabService'), { area: '36', district: '36110' })
  assert.equal(regionCodes('12210', '202607', 'AreaTarResDemService').district, '29110')
  assert.equal(regionCodes('12210', '202608', 'AreaTarResDemService').district, '12210')
  assert.equal(regionCodes('12210', '202607', 'DataLabService').district, '12210')
  const mokpo = tourismDistricts.find(d => d.name === '목포시')
  assert.equal(regionCodes(mokpo.id, '202606', 'DataLabService').district, '46110')
  assert.throws(() => regionCodes('28125', '202606', 'DataLabService'))
})

test('관광 API는 전국 지역을 받고 시도 누락·불일치·중복 입력의 잘못된 대체 조회를 막는다', () => {
  assert.equal(parseDistrictQuery('contents', regionQuery({ regionId: 'seoul', district: '11110' }), config).district, '11110')
  for (const query of ['regionId=seoul', 'regionId=busan&district=11110', 'regionId=seoul&regionId=busan&district=11110', 'regionId=seoul&district=all', 'district=__proto__']) {
    assert.throws(() => parseDistrictQuery('contents', new URLSearchParams(query), config))
  }
  assert.equal(parseDistrictQuery('summary', new URLSearchParams('district=all'), config).district, 'all')
  assert.equal(handleRegions('GET').body.districts.length, 269)
  assert.equal(handleRegions('POST').status, 405)
})

test('전국 방문자 원본을 한 번 수집하여 지역별 월간 집계를 분리하고 광주 별칭과 공유한다', async () => {
  let calls = 0
  const rows = []
  for (let day = 1; day <= 31; day++) for (let kind = 1; kind <= 3; kind++) {
    for (const [code, amount] of [['11110', 1], ['26110', 2], ['12210', 3]]) rows.push({ signguCode: code, baseYmd: `202608${String(day).padStart(2, '0')}`, touDivCd: String(kind), touNum: amount })
  }
  const client = { scope: 'national-visitors-test', all: async () => { calls++; return rows } }
  const seoul = await visitorMonth(client, '11110', '202608')
  const busan = await visitorMonth(client, '26110', '202608')
  const gwangju = await visitorMonth(client, 'donggu', '202608')
  assert.equal(seoul.total, 93)
  assert.equal(busan.total, 186)
  assert.equal(gwangju.total, 279)
  assert.deepEqual(gwangju, await visitorMonth(client, '12210', '202608'))
  assert.equal(calls, 1)
})

test('월간 브리핑 축제 수집은 세종의 전체 코드를 전달하고 다른 지역 응답을 제외한다', async () => {
  const context = parseContext('36110', '2026-08', '2026-09-17', 'sejong')
  const result = await collectSource(sourceSpecs.find(s => s.kind === 'festivals'), context, 'test-key', AbortSignal.timeout(5000), async input => {
    const params = new URL(String(input)).searchParams
    assert.equal(params.get('lDongRegnCd'), '36110')
    assert.equal(params.get('lDongSignguCd'), '36110')
    return envelope([
      { lDongRegnCd: '36110', lDongSignguCd: '36110', contentid: '1', title: '세종 행사', eventstartdate: '20261001', eventenddate: '20261003' },
      { lDongRegnCd: '11', lDongSignguCd: '110', contentid: '2', title: '다른 지역 행사', eventstartdate: '20261001', eventenddate: '20261003' },
    ])
  })
  assert.deepEqual(result.festivals.upcoming.map(item => item.title), ['세종 행사'])
})

test('월간 브리핑도 관광 API 장애 시 Supabase의 검증된 페이지를 재사용한다', async () => {
  const context = parseContext('12210', '2026-08', '2026-09-17', 'gwangju')
  let sourceCalls = 0
  const cachedRows = [{ areaCd: '12', signguCd: '12210', baseYm: '202608', tarSvcDemIxCd: '11', tarSvcDemIxVal: '65' }]
  const cache = {
    get: async () => ({ rows: cachedRows, total: 1, fetchedAt: '2026-09-20T00:00:00Z', age: 999999 }),
    store: async () => { throw new Error('stale fallback must not overwrite cache') },
  }
  const result = await collectSource(sourceSpecs[1], context, 'test-key', AbortSignal.timeout(5000), async () => {
    sourceCalls++; throw new Error('upstream unavailable')
  }, cache)
  assert.equal(sourceCalls, 1)
  assert.equal(result.evidence[0].value, '65')
  assert.match(result.source.note, /저장된 응답/)
})

test('월간 브리핑은 완전한 방문자 월 집계가 있으면 DataLab 원본을 다시 호출하지 않는다', async () => {
  const context = parseContext('12210', '2026-07', '2026-09-17', 'gwangju')
  let sourceCalls = 0
  const visitorCache = { get: async () => ({ ym:'202607',total:60,local:10,outside:20,foreign:30,
    observedDays:31,expectedDays:31,through:'20260731',sourceFetchedAt:'2026-09-20T00:00:00Z' }) }
  const result = await collectSource(sourceSpecs[0], context, 'test-key', AbortSignal.timeout(5000), async () => {
    sourceCalls++; throw new Error('must not fetch')
  }, null, visitorCache)
  assert.equal(sourceCalls, 0)
  assert.deepEqual(result.evidence.map(item => item.value), ['10','20','30'])
  assert.match(result.source.note, /저장된 완전 월/)
})

test('7월 자원 수요 수집은 개편 전 코드로 요청하고 동일 코드의 응답만 채택한다', async () => {
  const context = parseContext('12210', '2026-07', '2026-09-17')
  const result = await collectSource(sourceSpecs[1], context, 'test-key', AbortSignal.timeout(5000), async input => {
    const params = new URL(String(input)).searchParams
    assert.equal(params.get('areaCd'), '29')
    assert.equal(params.get('signguCd'), '29110')
    return envelope([{ areaCd: '29', signguCd: '29110', baseYm: '202607', tarSvcDemIxCd: '11', tarSvcDemIxVal: '5' }])
  })
  assert.equal(result.evidence[0].value, '5')
})

test('브리핑은 DB 조회 전에 시도 소속과 요청 형식을 검증한다', async () => {
  let calls = 0
  const service = createBriefingService({}, async () => { calls++; throw new Error('호출 금지') })
  for (const query of ['regionId=busan&district=11110', 'regionId=seoul', 'district=11110&district=26110', 'district=11110&serviceKey=bad']) assert.equal((await service('GET', new URLSearchParams(query))).status, 400)
  assert.equal(calls, 0)
})
