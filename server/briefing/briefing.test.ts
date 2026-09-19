import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyFestivals, collectSource, decodePage, districtCode, districts, koreaDate, parseContext, previousMonth, sourceSpecs, type CollectedSource } from './data.js'
import { geminiMerger, runBriefing, validateDiagnosis } from './graph.js'
import { createBriefingService } from './service.js'
import type { BriefingDiagnosis, BriefingEvidence, MonthlyBriefingData } from '../../src/types/briefing.js'

const context = parseContext('donggu', '2026-08', '2026-09-17')
const signal = () => AbortSignal.timeout(5_000)
const page = (rows: unknown[], total = rows.length) => ({ response: { header: { resultCode: '0000' }, body: { items: rows.length ? { item: rows } : '', totalCount: total } } })
const fact = (id: string): BriefingEvidence => ({ id: `${id}:1`, sourceId: id, label: id, value: '75', period: '2026-08', note: '지표값' })
const source = (id: string): CollectedSource => ({ source: { id, label: id, endpoint: id, status: 'ready', count: 1, note: '' }, evidence: [fact(id)] })
const diagnosis = (ids: string[]): BriefingDiagnosis => ({ summary: '제공된 지표를 확인했습니다.', summaryEvidenceIds: ids, findings: [{ title: '확인된 지표', description: '비교 기준 없이 증감을 판단하지 않습니다.', evidenceIds: ids }], recommendations: [], limitations: [] })
const mockFetch = (fn: (url: URL, init?: RequestInit) => unknown | Promise<unknown>): typeof fetch => (async (input: string | URL | Request, init?: RequestInit) => Response.json(await fn(new URL(String(input)), init))) as typeof fetch

test('한국 날짜와 연도 경계, 윤년 및 완료 월을 검증한다', () => {
  assert.equal(koreaDate(new Date('2026-12-31T15:00:00Z')), '2027-01-01')
  assert.equal(previousMonth('2027-01-01'), '2026-12')
  assert.equal(parseContext('donggu', null, '2027-01-01').month, '2026-12')
  for (const month of ['2026-13', '2026-09', '2024-08', '2026-8']) assert.throws(() => parseContext('donggu', month, '2026-09-17'))
  assert.throws(() => parseContext('__proto__', '2026-08', '2026-09-17'))
  assert.deepEqual(Object.values(districts).map((item) => item.code), ['29110', '29140', '29155', '29170', '29200'])
  assert.equal(districtCode('donggu', '2026-06'), '29110')
  assert.equal(districtCode('donggu', '2026-07'), '12210')
  assert.equal(districtCode('namgu', '2026-09-17'), '12270')
})

test('축제는 최근 종료·예정 시작으로 구분하고 진행 중·잘못된 날짜·중복을 제외한다', () => {
  const festival = (id: string, start: string, end: string) => ({ contentid: id, title: id, eventstartdate: start, eventenddate: end })
  const result = classifyFestivals([
    festival('recent', '20260901', '20260916'), festival('recent', '20260901', '20260916'),
    festival('ongoing', '20260901', '20260917'), festival('today', '20260917', '20260918'),
    festival('future', '20260918', '20270101'), festival('bad', '20260230', '20260301'),
    festival('old', '20250101', '20250105'), festival('far', '20270918', '20270919'),
  ], '2026-09-17')
  assert.deepEqual(result.recent.map((item) => item.title), ['recent'])
  assert.deepEqual(result.upcoming.map((item) => item.title), ['future'])
})

test('API 빈 결과·단일 항목·오류 코드를 구분한다', () => {
  assert.deepEqual(decodePage(page([])), { rows: [], total: 0 })
  assert.equal(decodePage({ response: { header: { resultCode: '0000' }, body: { items: { item: { title: '축제' } }, totalCount: '1' } } }).rows.length, 1)
  assert.throws(() => decodePage({ response: { header: { resultCode: '30' } } }))
  assert.throws(() => decodePage({ response: { header: { resultCode: '0000' }, body: {} } }))
})

test('전국 자료의 다음 페이지까지 읽고 지역·날짜·방문자 유형을 분리한다', async () => {
  const visited: string[] = []
  const row = (code: string, day: string, kind: string, count: string) => ({ signguCode: code, baseYmd: day, touDivCd: kind, touDivNm: kind, touNum: count })
  const result = await collectSource(sourceSpecs[0], context, 'test-secret', signal(), mockFetch((url) => {
    visited.push(url.searchParams.get('pageNo')!)
    assert.equal(url.searchParams.has('signguCd'), false)
    if (visited.length === 1) return page([row('11110', '20260801', '1', '99999')], 6)
    return page([row('12210', '20260801', '1', '10'), row('12210', '20260801', '1', '10'), row('12210', '20260802', '2', '20'), row('12210', '20260701', '1', '500'), row('12210', '20260803', '1', '')], 6)
  }))
  assert.deepEqual(visited, ['1', '2'])
  assert.deepEqual(result.evidence.map((item) => item.value), ['10', '20'])
  assert.equal(result.source.status, 'partial')
  assert.match(result.evidence[0].note, /1\/31일/)
  assert.doesNotMatch(JSON.stringify(result), /test-secret|99999/)
})

test('지표 요청은 명시 코드와 조회 월을 사용하고 0과 결측값을 구분한다', async () => {
  const result = await collectSource(sourceSpecs[1], context, 'test-secret', signal(), mockFetch((url) => {
    assert.equal(url.searchParams.get('tarSvcDemIxCd'), '11')
    assert.equal(url.searchParams.get('signguCd'), '12210')
    return page([
      { areaCd: '12', signguCd: '12210', baseYm: '202608', tarSvcDemIxCd: '11', tarSvcDemIxVal: '0' },
      { areaCd: '12', signguCd: '12210', baseYm: '202607', tarSvcDemIxCd: '11', tarSvcDemIxVal: '90' },
      { areaCd: '11', signguCd: '11530', baseYm: '202608', tarSvcDemIxCd: '11', tarSvcDemIxVal: '90' },
    ])
  }))
  assert.equal(result.evidence.length, 1)
  assert.equal(result.evidence[0].value, '0')
})

test('API가 실패해도 이미 받은 페이지는 부분 결과로 보존하며 오류의 비밀값을 숨긴다', async () => {
  let count = 0
  const result = await collectSource(sourceSpecs[1], context, 'test-secret', signal(), mockFetch(() => {
    if (count++) throw new Error('https://example.org/?serviceKey=test-secret')
    return page([{ areaCd: '12', signguCd: '12210', baseYm: '202608', tarSvcDemIxCd: '11', tarSvcDemIxVal: '72' }], 2)
  }))
  assert.equal(result.source.status, 'partial')
  assert.equal(result.evidence[0].value, '72')
  assert.doesNotMatch(JSON.stringify(result), /test-secret/)
})

test('축제 조회에 최신 법정동 코드를 쓰고 다른 지역 행사를 제외한다', async () => {
  const result = await collectSource(sourceSpecs[9], context, 'test-secret', signal(), mockFetch((url) => {
    assert.equal(url.searchParams.get('lDongSignguCd'), '210')
    assert.equal(url.searchParams.get('lDongRegnCd'), '12')
    // 종료일 상한을 보내면 90일 안에 시작하지만 길게 열리는 행사를 놓칩니다.
    assert.equal(url.searchParams.has('eventEndDate'), false)
    return page([
      { lDongRegnCd: '12', lDongSignguCd: '210', contentid: '1', title: '예정 행사', eventstartdate: '20260918', eventenddate: '20270101' },
      { lDongRegnCd: '31', lDongSignguCd: '210', contentid: '2', title: '다른 지역', eventstartdate: '20260918', eventenddate: '20260919' },
    ])
  }))
  assert.equal(result.festivals?.upcoming.length, 1)
  assert.equal(result.festivals?.upcoming[0].title, '예정 행사')
})

test('모델이 만든 가짜 출처와 잘못된 응답 형식은 거부한다', () => {
  assert.throws(() => validateDiagnosis(diagnosis(['invented']), [fact('a')]))
  assert.throws(() => validateDiagnosis({ summary: '문장뿐인 결과' }, [fact('a')]))
  assert.equal(validateDiagnosis(diagnosis(['a:1']), [fact('a')]).findings.length, 1)
})

test('LangGraph는 이전 진단과 새 API 근거를 차례대로 병합한다', async () => {
  const calls: string[] = []
  const result = await runBriefing(context, { serviceKey: 'unused', dependencies: {
    collect: async () => [source('a'), source('b'), source('c')],
    merge: async (input) => {
      calls.push(input.current.source.id)
      assert.equal(input.evidence.length, calls.length)
      assert.equal(input.previous?.summaryEvidenceIds.length ?? 0, calls.length - 1)
      return diagnosis(input.evidence.map((item) => item.id))
    },
  } })
  assert.deepEqual(calls, ['a', 'b', 'c'])
  assert.equal(result.aiStatus, 'ready')
  assert.equal(result.diagnosis?.summaryEvidenceIds.length, 3)
  assert.deepEqual(result.steps.map((step) => step.status), ['merged', 'merged', 'merged'])
})

test('중간 AI 오류와 빈 출처를 건너뛰고 나머지 진단과 근거를 보존한다', async () => {
  const empty = source('empty'); empty.evidence = []; empty.source.status = 'empty'
  const result = await runBriefing(context, { serviceKey: 'unused', dependencies: {
    collect: async () => [source('a'), source('b'), empty, source('c')],
    merge: async (input) => {
      if (input.current.source.id === 'b') throw new Error('모델 오류')
      return diagnosis(input.evidence.map((item) => item.id))
    },
  } })
  assert.equal(result.aiStatus, 'partial')
  assert.equal(result.evidence.length, 3)
  assert.deepEqual(result.steps.map((step) => step.status), ['merged', 'failed', 'skipped', 'merged'])
})

test('Gemini 키가 없으면 AI 결과를 지어내지 않는다', async () => {
  const result = await runBriefing(context, { serviceKey: 'unused', dependencies: { collect: async () => [source('a')] } })
  assert.equal(result.aiStatus, 'unavailable')
  assert.equal(result.diagnosis, null)
  assert.equal(result.evidence.length, 1)
})

test('Gemini REST 요청은 헤더로 키를 보내고 구조화 응답을 검증한다', async () => {
  const merge = geminiMerger('test-gemini-secret', 'gemini-3.8-flash', mockFetch((url, init) => {
    assert.equal(url.hostname, 'generativelanguage.googleapis.com')
    assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'test-gemini-secret')
    assert.doesNotMatch(String(init?.body), /test-gemini-secret/)
    const body = JSON.parse(String(init?.body))
    assert.equal(body.generationConfig.responseMimeType, 'application/json')
    assert.ok(body.generationConfig.responseJsonSchema)
    return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(diagnosis(['a:1'])) }] } }] }
  }))
  const result = await merge({ context, previous: null, current: source('a'), evidence: [fact('a')], sources: [] }, signal())
  assert.equal(result.findings.length, 1)
})

test('Gemini 일시 과부하(503)는 재시도하고 할당량 초과(429)는 재시도하지 않는다', async () => {
  const input = { context, previous: null, current: source('a'), evidence: [fact('a')], sources: [] }
  const ok = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(diagnosis(['a:1'])) }] } }] }
  let calls = 0
  const flaky = (async () => ++calls < 3 ? Response.json({ error: {} }, { status: 503 }) : Response.json(ok)) as typeof fetch
  assert.equal((await geminiMerger('k', 'gemini-3.8-flash', flaky, 0)(input, signal())).findings.length, 1)
  assert.equal(calls, 3)
  calls = 0
  const quota = (async () => { calls++; return Response.json({ error: {} }, { status: 429 }) }) as typeof fetch
  await assert.rejects(geminiMerger('k', 'gemini-3.8-flash', quota, 0)(input, signal()))
  assert.equal(calls, 1)
})

test('서비스는 요청 조건과 키를 검증하고 동일 요청을 합치며 캐시를 만료한다', async () => {
  let runs = 0
  let time = 0
  const query = new URLSearchParams({ district: 'donggu' })
  const service = createBriefingService({ TOUR_API_SERVICE_KEY: 'secret' }, async (ctx) => {
    runs++
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { district: ctx.district, aiStatus: 'ready', sources: [{ status: 'ready' }] } as MonthlyBriefingData
  }, () => time)
  assert.equal((await service('POST', query)).status, 405)
  assert.equal((await service('GET', new URLSearchParams({ district: 'bad' }))).status, 400)
  const results = await Promise.all([service('GET', query), service('GET', query)])
  assert.equal(runs, 1)
  assert.equal(results[0].status, 200)
  await service('GET', query)
  assert.equal(runs, 1)
  time = 3_600_001
  await service('GET', query)
  assert.equal(runs, 2)
  assert.equal((await createBriefingService({})('GET', query)).status, 503)
})
