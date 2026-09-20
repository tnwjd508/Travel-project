import test from 'node:test'
import assert from 'node:assert/strict'
import { loadMonthlyBriefing } from '../.test-build/src/lib/monthlyBriefingClient.js'
import { fixture } from './helpers/briefing-db.mjs'

const selection = { regionId: 'seoul', district: '11110' }
const month = '2026-08'
const data = { ...fixture({ district: '11110', month }), storage: { savedAt: new Date().toISOString() } }
const invoke = (responses, options = {}) => {
  const methods = []
  const urls = []
  return { methods, urls, result: loadMonthlyBriefing(selection, month, {
    signal: new AbortController().signal, allowCreate: true, wait: async () => {},
    fetcher: async (url, init) => { urls.push(String(url)); methods.push(init.method); const next = responses.shift(); if (!next) throw new Error('불필요한 추가 호출'); return Response.json(next.body, { status: next.status }) },
    ...options,
  }) }
}
const missing = { status: 404, body: { state: 'missing', code: 'NOT_GENERATED', message: '미생성' } }
const generating = { status: 202, body: { state: 'generating', code: 'GENERATING', message: '생성 중' } }

test('저장된 브리핑은 GET 한 번으로 종료한다', async () => {
  const { result, methods, urls } = invoke([{ status: 200, body: data }])
  assert.deepEqual((await result).data, data)
  assert.deepEqual(methods, ['GET'])
  assert.deepEqual(urls, ['/api/monthly-briefing?regionId=seoul&district=11110&month=2026-08'])
})
test('처음에만 POST하고 생성 중 상태는 GET으로 조회한다', async () => {
  const { result, methods } = invoke([missing, generating, generating, { status: 200, body: data }])
  await result
  assert.deepEqual(methods, ['GET', 'POST', 'GET', 'GET'])
})
test('다른 사용자가 생성 중이면 POST를 보내지 않는다', async () => {
  const { result, methods } = invoke([generating, { status: 200, body: data }])
  await result
  assert.deepEqual(methods, ['GET', 'GET'])
})
test('오류 후 저장 상태 다시 조회는 생성하지 않는다', async () => {
  const { result, methods } = invoke([missing], { allowCreate: false })
  await assert.rejects(result, /미생성/)
  assert.deepEqual(methods, ['GET'])
})
test('실패한 월은 근거를 보여주고 재생성을 하지 않는다', async () => {
  const { result, methods } = invoke([{ status: 409, body: { state: 'failed', code: 'AI_UNAVAILABLE', message: '자동 재생성하지 않습니다.', snapshot: fixture({ district: '11110', month }, 'unavailable') } }])
  assert.equal((await result).data.aiStatus, 'unavailable')
  assert.deepEqual(methods, ['GET'])
})
test('화면 이탈로 취소되면 다음 상태 조회를 멈춘다', async () => {
  const controller = new AbortController()
  const { result, methods } = invoke([generating], { signal: controller.signal, wait: async () => { controller.abort() } })
  await assert.rejects(result, error => error.name === 'AbortError')
  assert.deepEqual(methods, ['GET'])
})
test('다른 지역의 저장 응답은 표시하지 않는다', async () => {
  const { result } = invoke([{ status: 200, body: { ...data, district: '26110' } }])
  await assert.rejects(result, /응답을 확인/)
})

test('저장소 미설정 응답도 이번 조회 결과로 표시한다', async () => {
  const { storage: _stored, ...withoutStorage } = data
  const { result, methods } = invoke([{ status: 200, body: withoutStorage }])
  assert.equal((await result).data.storage, undefined)
  assert.deepEqual(methods, ['GET'])
  const wrongMonth = invoke([{ status: 200, body: { ...withoutStorage, month: '2026-07' } }])
  await assert.rejects(wrongMonth.result, /브리핑 응답을 확인할 수 없습니다/)
})
