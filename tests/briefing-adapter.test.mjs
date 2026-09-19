import test from 'node:test'
import assert from 'node:assert/strict'
import { createBriefingBudget } from '../.test-build/server/briefing/budget.js'
import handler from '../.test-build/api/monthly-briefing.js'

test('briefing worker enforces request/daily budgets, resets by UTC day and rejects redirects', async () => {
  let calls = 0
  let time = Date.parse('2026-09-17T23:59:00Z')
  const budget = createBriefingBudget(async (_url, options) => { calls++; assert.equal(options.redirect, 'error'); return Response.json({}) }, () => time, {request: 1, daily: 2})
  const url = 'https://apis.data.go.kr/B551011/Example/operation'
  await budget.run(async () => { await budget.fetch(url); await assert.rejects(budget.fetch(url)) })
  await budget.run(() => budget.fetch(url))
  await assert.rejects(budget.run(() => budget.fetch(url)))
  assert.equal(calls, 2)
  time += 120000
  await budget.run(() => budget.fetch(url))
  assert.equal(calls, 3)
})

test('Vercel monthly adapter forwards token, query and retry headers to FastAPI', async () => {
  const oldFetch = globalThis.fetch
  const oldOrigin = process.env.FASTAPI_BASE_URL
  const oldToken = process.env.FASTAPI_PROXY_TOKEN
  try {
    process.env.FASTAPI_BASE_URL = 'https://backend.example.test'
    process.env.FASTAPI_PROXY_TOKEN = 'test-token'
    globalThis.fetch = async (url, options) => {
      assert.equal(url.origin, 'https://backend.example.test')
      assert.equal(url.pathname, '/api/monthly-briefing')
      assert.equal(url.searchParams.get('district'), '11110')
      assert.equal(options.headers['X-Ongil-Proxy-Token'], 'test-token')
      assert.equal(options.redirect, 'error')
      return Response.json({message:'busy'}, {status:429,headers:{'Retry-After':'30'}})
    }
    let status, body
    const headers = {}
    const response = {status(value) {status=value; return this}, json(value) {body=value}, setHeader(key,value) {headers[key]=value}}
    await handler({method:'GET',query:{regionId:'seoul',district:'11110'}},response)
    assert.equal(status,429); assert.equal(body.message,'busy'); assert.equal(headers['Retry-After'],'30')
    assert.equal(headers['Cache-Control'],'no-store')
  } finally {
    globalThis.fetch = oldFetch
    if (oldOrigin === undefined) delete process.env.FASTAPI_BASE_URL; else process.env.FASTAPI_BASE_URL = oldOrigin
    if (oldToken === undefined) delete process.env.FASTAPI_PROXY_TOKEN; else process.env.FASTAPI_PROXY_TOKEN = oldToken
  }
})
