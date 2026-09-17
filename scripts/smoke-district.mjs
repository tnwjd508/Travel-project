// Run after npm test. Credentials are held in memory and never written to disk.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const keyFileIndex = process.argv.indexOf('--key-file')
if (!process.env.TOUR_API_SERVICE_KEY && keyFileIndex >= 0) {
  const text = await readFile(process.argv[keyFileIndex + 1], 'utf8')
  const match = text.match(/(?:TOUR_API_SERVICE_KEY\s*=|인증키\s*:)\s*([A-Za-z0-9%+/=_-]+)/)
  if (!match) throw new Error('인증키 파일 형식을 확인하세요. 값은 출력하지 않습니다.')
  process.env.TOUR_API_SERVICE_KEY = match[1]
}
if (!process.env.TOUR_API_SERVICE_KEY) throw new Error('TOUR_API_SERVICE_KEY 또는 --key-file 경로가 필요합니다.')
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } })
await server.listen()
const address = server.httpServer.address()
const base = `http://127.0.0.1:${address.port}`
let failures = 0
const historyMonths = process.argv.includes('--full-history') ? 12 : 2
try {
  const cases = [
    ['summary', 'district=donggu'], ['contents', 'district=donggu'],
    ['festivals', 'district=donggu&from=20260901'], ['visitors', `district=donggu&months=${historyMonths}`],
    ['indices', 'district=donggu'], ['related', 'district=donggu'],
    ['rank', 'district=donggu&metric=21'], ['diagnosis', 'district=donggu'],
    ['summary', 'district=all'],
  ]
  for (const [resource, query] of cases) {
    const started = performance.now()
    const response = await fetch(`${base}/api/district/${resource}?${query}`, { signal: AbortSignal.timeout(90000) })
    const body = await response.json()
    const info = { resource, status: response.status, elapsedMs: Math.round(performance.now() - started), baseYm: body.baseYm, fetchedAt: body.fetchedAt, warnings: body.warnings, cache: response.headers.get('cache-control') }
    if (!response.ok) { failures++; console.log(JSON.stringify({ ...info, code: body.code, resultCode: body.resultCode })); continue }
    assert.equal(body.source, '출처: ⓒ한국관광공사')
    if (resource === 'summary') {
      if (body.items) { assert.equal(body.items.length, 5); info.districts = body.items.map(d => ({ district: d.district, total: d.visitors.total, complete: d.visitors.complete })) }
      else { info.visitors = body.visitors; info.stay = body.stay }
    }
    if (resource === 'indices') { assert.equal(Object.values(body.groups).flatMap(Object.keys).length, 49); info.missing = Object.fromEntries(Object.entries(body.groups).map(([group, values]) => [group, Object.entries(values).filter(([, v]) => v === null).map(([code]) => code)])) }
    if (resource === 'visitors') { assert.equal(body.series.length, historyMonths); assert.equal(body.previousYear.length, historyMonths); info.months = body.series.map(m => ({ ym: m.ym, complete: m.complete, total: m.total })); info.previousYearComplete = body.previousYear.every(m => m.complete) }
    if (resource === 'rank') { info.rank = body.rank; info.total = body.total; info.missingAreas = body.missingAreas }
    if (resource === 'diagnosis') { assert.equal(body.issues.length, 4); assert.equal(body.radar.length, 6); info.activationIndex = body.activationIndex; info.model = body.model.version }
    if (body.items && resource !== 'summary') info.items = body.items.length
    if (resource === 'related') { info.hubs = body.hubs.length; info.top3Share = body.top3Share }
    console.log(JSON.stringify(info))
  }
  for (const [path, expected] of [['/api/district/summary?district=constructor',400],['/api/district/visitors?months=13',400],['/api/district/not-real',404]]) {
    assert.equal((await fetch(base + path)).status, expected)
  }
  assert.equal(failures, 0, `${failures}개 API 검증 실패`)
} finally { await server.close() }
