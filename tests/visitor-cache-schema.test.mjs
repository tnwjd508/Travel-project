import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const migration = new URL('../supabase/migrations/20260920104513_tourism_visitor_month_cache.sql', import.meta.url)

test('관광객 월별 캐시는 서버 전용이며 완전한 새 자료로만 안전하게 갱신된다', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec('create role anon; create role authenticated; create role service_role;')
  await db.exec(await readFile(migration, 'utf8'))
  const previousMonth = (await db.query("select to_char(date_trunc('month', timezone('Asia/Seoul', now())) - interval '1 month', 'YYYYMM') ym")).rows[0].ym
  const monthDate = `${previousMonth.slice(0, 4)}-${previousMonth.slice(4)}-01`
  const expectedDays = new Date(Date.UTC(Number(previousMonth.slice(0, 4)), Number(previousMonth.slice(4)), 0)).getUTCDate()
  const fetchedAt = new Date(Date.now() - 60_000).toISOString()
  const row = {
    region_id: 'jeonnam-gwangju', district_id: '12210', base_month: monthDate,
    local_visitors: 10, outside_visitors: 20, foreign_visitors: 30, total_visitors: 60,
    complete: true, observed_days: expectedDays, expected_days: expectedDays,
    through_date: `${previousMonth.slice(0, 4)}-${previousMonth.slice(4)}-${expectedDays}`,
    source_fetched_at: fetchedAt,
  }
  const rpc = async (name, args) => (await db.query(
    `select public.${name}(${Object.keys(args).map((key, index) => `${key} => $${index + 1}`).join(',')}) value`,
    Object.entries(args).map(([key, value]) => key === 'p_months' ? `{${value.join(',')}}` : typeof value === 'object' ? JSON.stringify(value) : value),
  )).rows[0].value

  await db.exec('set role service_role')
  assert.equal(await rpc('visitor_months_store', { p_rows: [row] }), 1)
  const stored = await rpc('visitor_months_get', {
    p_region_id: 'jeonnam-gwangju', p_district_id: '12210', p_months: [monthDate],
  })
  assert.equal(stored.length, 1)
  assert.equal(stored[0].ym, previousMonth)
  assert.equal(Number(stored[0].total), 60)
  assert.equal(stored[0].complete, true)

  const partial = { ...row, local_visitors: null, outside_visitors: null, foreign_visitors: null,
    total_visitors: null, complete: false, observed_days: expectedDays - 1,
    through_date: `${previousMonth.slice(0, 4)}-${previousMonth.slice(4)}-${expectedDays - 1}`,
    source_fetched_at: new Date().toISOString() }
  assert.equal(await rpc('visitor_months_store', { p_rows: [partial] }), 0)
  assert.equal(Number((await rpc('visitor_months_get', {
    p_region_id: 'jeonnam-gwangju', p_district_id: '12210', p_months: [monthDate],
  }))[0].total), 60)

  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    await assert.rejects(rpc('visitor_months_get', {
      p_region_id: 'jeonnam-gwangju', p_district_id: '12210', p_months: [monthDate],
    }), /permission denied/)
    await assert.rejects(db.query('select * from public.tourism_visitor_months'), /permission denied/)
  }
})
