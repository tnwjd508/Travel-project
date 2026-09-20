import test from 'node:test'
import assert from 'node:assert/strict'
import reviews from '../.test-build/api/scenarios/[id]/reviews.js'
import detail from '../.test-build/api/scenario-reviews/[id].js'
import evidence from '../.test-build/api/policy-evidence.js'

test('review adapters preserve identity, scope, request key and private caching', async () => {
  const oldFetch = globalThis.fetch, oldOrigin = process.env.FASTAPI_BASE_URL
  const id = '10000000-0000-4000-8000-000000000001'
  let status, body
  const headers = {}, requests = []
  const response = { status(n) { status = n; return this }, json(value) { body = value }, setHeader(k,v) { headers[k] = v } }
  try {
    process.env.FASTAPI_BASE_URL = 'https://backend.example'
    globalThis.fetch = async (url, options) => {
      requests.push({url, options})
      return Response.json({ ok: true }, { headers: { 'cache-control': 'public, max-age=100' } })
    }
    await reviews({method:'POST', query:{id}, headers:{authorization:'Bearer user', 'idempotency-key':'same-key'}, body:{organizationId:id}},response)
    assert.equal(status,200); assert.equal(body.ok,true)
    assert.equal(requests[0].url.pathname,`/api/scenarios/${id}/reviews`)
    assert.equal(requests[0].url.search,'')
    assert.equal(requests[0].options.headers.authorization,'Bearer user')
    assert.equal(requests[0].options.headers['idempotency-key'],'same-key')
    assert.deepEqual(JSON.parse(requests[0].options.body),{organizationId:id})
    assert.equal(headers['Cache-Control'],'no-store')
    await detail({method:'GET', query:{id,organizationId:id},headers:{authorization:'Bearer user'}},response)
    assert.equal(requests[1].url.pathname,`/api/scenario-reviews/${id}`)
    assert.equal(requests[1].url.searchParams.get('organizationId'),id)
    assert.equal(requests[1].options.headers.authorization,'Bearer user')
    assert.equal(headers['Cache-Control'],'no-store')
    await detail({method:'POST',query:{id}},response); assert.equal(status,405)
    await reviews({method:'POST',query:{id:'../../account/config'}},response); assert.equal(status,400)
    await evidence({method:'POST',query:{}},response); assert.equal(status,405)
    assert.equal(requests.length,2)
    process.env.FASTAPI_BASE_URL='http://remote.example'
    await detail({method:'GET',query:{id},headers:{authorization:'Bearer user'}},response)
    assert.equal(status,502); assert.equal(requests.length,2)
  } finally {
    globalThis.fetch=oldFetch
    if (oldOrigin===undefined) delete process.env.FASTAPI_BASE_URL; else process.env.FASTAPI_BASE_URL=oldOrigin
  }
})
