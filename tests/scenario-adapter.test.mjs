import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../.test-build/api/scenarios/index.js'
import detail from '../.test-build/api/scenarios/[id].js'
import account from '../.test-build/api/account/[action].js'
import { proxyFastApi } from '../.test-build/server/fastApiProxy.js'

test('기관 프록시는 사용자 JWT·요청 키·본문을 전달하며 다른 경로는 확장하지 않는다', async () => {
  const oldFetch = globalThis.fetch
  const oldOrigin = process.env.FASTAPI_BASE_URL
  const oldToken = process.env.FASTAPI_PROXY_TOKEN
  let status, body, calls = 0
  const headers = {}
  const response = { status(value) { status=value; return this }, json(value) { body=value }, setHeader(key,value) { headers[key]=value } }
  try {
    process.env.FASTAPI_BASE_URL = 'https://backend.example'
    process.env.FASTAPI_PROXY_TOKEN = 'origin-only'
    globalThis.fetch = async (url, options) => {
      calls++
      assert.equal(url.pathname, '/api/scenarios')
      assert.equal(options.headers.authorization, 'Bearer user-token')
      assert.equal(options.headers['idempotency-key'], 'request-key')
      assert.equal(options.headers['X-Ongil-Proxy-Token'], 'origin-only')
      assert.deepEqual(JSON.parse(options.body), { budgetKrw: 1500000000 })
      return Response.json({ id: 'stored' }, { headers: { 'Cache-Control': 'public,max-age=100' } })
    }
    await handler({ method:'POST', query:{}, headers:{authorization:'Bearer user-token','idempotency-key':'request-key'}, body:{budgetKrw:1500000000} },response)
    assert.equal(status,200); assert.equal(body.id,'stored'); assert.equal(headers['Cache-Control'],'no-store')
    await handler({ method:'DELETE',query:{} },response)
    assert.equal(status,405)
    await handler({ method:'POST',query:{},body:'x'.repeat(16385) },response)
    assert.equal(status,413)
    await proxyFastApi('/api/district/summary',{method:'POST',query:{}},response)
    assert.equal(status,405); assert.equal(headers.Allow,'GET')
    await detail({method:'GET',query:{id:'../account/config'}},response)
    assert.equal(status,400)
    await account({method:'GET',query:{action:'unknown'}},response)
    assert.equal(status,404)
    assert.equal(calls,1)
    process.env.FASTAPI_BASE_URL = 'http://remote.example'
    await handler({method:'POST',query:{},headers:{authorization:'Bearer user-token'},body:{}},response)
    assert.equal(status,502); assert.equal(calls,1)
  } finally {
    globalThis.fetch=oldFetch
    if (oldOrigin === undefined) delete process.env.FASTAPI_BASE_URL; else process.env.FASTAPI_BASE_URL=oldOrigin
    if (oldToken === undefined) delete process.env.FASTAPI_PROXY_TOKEN; else process.env.FASTAPI_PROXY_TOKEN=oldToken
  }
})
