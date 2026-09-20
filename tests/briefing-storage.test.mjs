import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createTestDatabase, fixture, testEnv } from './helpers/briefing-db.mjs'
import { createBriefingService } from '../.test-build/server/briefing/service.js'
import { createSupabaseRepository } from '../.test-build/server/briefing/repository.js'

test('월간 브리핑 PostgreSQL 저장 및 동시 생성 방지', async t => {
  const { db, month, repository, fetcher } = await createTestDatabase()
  t.after(() => db.close())
  const query = (district = 'gwangsangu', regionId = 'gwangju', selectedMonth = month) => new URLSearchParams({ district, regionId, month: selectedMonth })
  let runs = 0
  const runner = async context => { runs++; return fixture(context, 'partial') }
  const service = createBriefingService(testEnv, runner, repository)

  await t.test('GET은 생성하지 않고 최초 POST만 저장한다', async () => {
    assert.equal((await service('GET', query())).status, 404)
    assert.equal(runs, 0)
    const created = await service('POST', query())
    assert.equal(created.status, 200)
    assert.equal(created.body.aiStatus, 'partial')
    assert.ok(created.body.storage.savedAt)
    for (let i = 0; i < 10; i++) assert.deepEqual((await service('GET', query())).body, created.body)
    assert.equal((await service('POST', query())).status, 200)
    assert.equal(runs, 1)
  })

  await t.test('재시작·별칭·키 미설정에도 같은 결과를 반환한다', async () => {
    const restarted = createBriefingService({}, runner, createSupabaseRepository(testEnv, fetcher))
    const alias = await restarted('GET', query())
    const canonical = await restarted('POST', query('12330', 'jeonnam-gwangju'))
    assert.equal(canonical.status, 200)
    assert.equal(canonical.body.district, '12330')
    assert.equal(alias.body.storage.savedAt, canonical.body.storage.savedAt)
    assert.equal(runs, 1)
  })

  await t.test('독립 서버 두 개가 동시에 요청해도 한 번만 실행한다', async () => {
    let release
    const gate = new Promise(resolve => { release = resolve })
    let started
    const startedPromise = new Promise(resolve => { started = resolve })
    let count = 0
    const slow = async context => { count++; started(); await gate; return fixture(context) }
    const a = createBriefingService(testEnv, slow, createSupabaseRepository(testEnv, fetcher))
    const b = createBriefingService(testEnv, slow, createSupabaseRepository(testEnv, fetcher))
    const first = a('POST', query('11110', 'seoul'))
    await startedPromise
    assert.equal((await b('POST', query('11110', 'seoul'))).status, 202)
    assert.equal((await b('GET', query('11110', 'seoul'))).status, 202)
    release()
    assert.equal((await first).status, 200)
    assert.equal(count, 1)
  })

  await t.test('다른 월과 지역은 별도로 저장한다', async () => {
    const older = new Date(`${month}-01T00:00:00Z`); older.setUTCMonth(older.getUTCMonth() - 1)
    assert.equal((await service('POST', query('gwangsangu', 'gwangju', older.toISOString().slice(0, 7)))).status, 200)
    assert.equal((await service('POST', query('26110', 'busan'))).status, 200)
    assert.equal((await db.query('select count(*)::int as count from public.monthly_briefings')).rows[0].count, 4)
  })

  await t.test('전체 AI 실패는 작업에만 기록하고 재생성하지 않는다', async () => {
    let count = 0
    const failed = createBriefingService(testEnv, async context => { count++; return fixture(context, 'unavailable') }, repository)
    const params = query('27110', 'daegu')
    const result = await failed('POST', params)
    assert.equal(result.status, 409)
    assert.equal(result.body.snapshot.evidence.length, 1)
    assert.equal((await failed('POST', params)).status, 409)
    assert.equal((await failed('GET', params)).status, 409)
    assert.equal(count, 1)
  })

  await t.test('저장 성공 응답이 유실돼도 AI 대신 저장만 재시도한다', async () => {
    let saves = 0, count = 0
    const flaky = { ...repository, finish: async (...args) => {
      const result = await repository.finish(...args)
      if (++saves === 1) throw new Error('DB 응답 유실')
      return result
    } }
    const saving = createBriefingService(testEnv, async context => { count++; return fixture(context) }, flaky)
    assert.equal((await saving('POST', query('11140', 'seoul'))).status, 200)
    assert.equal(saves, 2); assert.equal(count, 1)
  })

  await t.test('만료된 작업은 선점하지 않고 권한 없는 완료도 거부한다', async () => {
    await db.exec("update public.monthly_briefing_jobs set started_at = now() - interval '2 minutes'")
    const key = { regionId: 'seoul', districtId: '11170', month }
    const owner = randomUUID()
    assert.equal((await repository.claim(key, owner)).state, 'claimed')
    await assert.rejects(repository.finish(key, null, fixture({ district: key.districtId, month }), 'gemini-3.8-flash'))
    await assert.rejects(repository.finish(key, randomUUID(), fixture({ district: key.districtId, month }), 'gemini-3.8-flash'))
    await db.exec("update public.monthly_briefing_jobs set deadline_at = now() - interval '1 second' where district_id = '11170'")
    assert.equal((await repository.claim(key, randomUUID())).state, 'interrupted')
    await assert.rejects(repository.finish(key, owner, fixture({ district: key.districtId, month }), 'gemini-3.8-flash'))
  })

  await t.test('DB가 끊기면 메모리나 AI로 우회하지 않는다', async () => {
    const broken = { ...repository, get: async () => { throw new Error('secret-database-url') } }
    const guarded = createBriefingService(testEnv, runner, broken)
    const before = runs
    const result = await guarded('POST', query())
    assert.equal(result.status, 503)
    assert.doesNotMatch(JSON.stringify(result), /secret-database-url/)
    assert.equal(runs, before)
  })

  await t.test('DB 제약과 권한이 결과 덮어쓰기 및 클라이언트 실행을 막는다', async () => {
    await assert.rejects(db.exec(`insert into public.monthly_briefings (region_id,district_id,analysis_month,payload,ai_status,generated_at,festival_as_of,model_name)
      select region_id,district_id,analysis_month,payload,ai_status,generated_at,festival_as_of,model_name from public.monthly_briefings limit 1`), error => error.code === '23505')
    await assert.rejects(db.exec("update public.monthly_briefings set model_name = 'changed'"), /변경하거나 삭제/)
    await assert.rejects(db.exec('delete from public.monthly_briefings'), /변경하거나 삭제/)
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await db.exec(`set role ${role}`)
      try {
        await assert.rejects(db.query('select * from public.monthly_briefings'), /permission denied/)
        if (role !== 'service_role') await assert.rejects(db.query('select public.briefing_get($1,$2,$3)', ['seoul', '11110', `${month}-01`]), /permission denied/)
        else assert.equal((await repository.get({ regionId: 'seoul', districtId: '11110', month })).state, 'stored')
      } finally { await db.exec('reset role') }
    }
  })

  await t.test('전역 동시 생성 수와 분당 생성 수를 서버 인스턴스 간에 제한한다', async () => {
    await db.exec("update public.monthly_briefing_jobs set started_at = now() - interval '2 minutes'")
    const one = { regionId: 'seoul', districtId: '11200', month }
    const two = { regionId: 'seoul', districtId: '11215', month }
    const three = { regionId: 'seoul', districtId: '11230', month }
    assert.equal((await repository.claim(one, randomUUID())).state, 'claimed')
    assert.equal((await repository.claim(two, randomUUID())).state, 'claimed')
    assert.equal((await repository.claim(three, randomUUID())).state, 'busy')
    await db.exec("update public.monthly_briefing_jobs set deadline_at = now() - interval '1 second', started_at = now()")
    assert.equal((await repository.claim(three, randomUUID())).state, 'busy')
  })
})

test('Supabase 오류·잘못된 저장 결과와 비밀키를 외부에 노출하지 않는다', async () => {
  const key = { regionId: 'seoul', districtId: '11110', month: '2026-08' }
  let seenHeaders
  const repo = createSupabaseRepository(testEnv, async (_url, init) => {
    seenHeaders = init.headers
    return Response.json({ message: 'sb_secret_test 민감한 오류' }, { status: 401 })
  })
  await assert.rejects(repo.get(key), error => error.code === 'DB_UNAVAILABLE' && !/sb_secret_test|민감한/.test(error.message))
  assert.equal(seenHeaders.apikey, 'sb_secret_test')
  assert.equal(seenHeaders.Authorization, undefined)
  const wrong = createSupabaseRepository(testEnv, async () => Response.json({ state: 'stored', savedAt: new Date().toISOString(), data: fixture({ district: '26110', month: key.month }) }))
  await assert.rejects(wrong.get(key), error => error.code === 'DB_UNAVAILABLE')
})
