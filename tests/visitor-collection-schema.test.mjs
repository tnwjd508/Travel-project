import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

test('방문자 월 수집은 한 번만 선점하고 저장과 완료를 한 트랜잭션으로 처리한다', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec('create role anon; create role authenticated; create role service_role;')
  for (const file of ['20260920104513_tourism_visitor_month_cache.sql', '20260920163732_tourism_visitor_collection_jobs.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  }
  const months = (await db.query("select to_char(date_trunc('month', timezone('Asia/Seoul', now())) - interval '1 month','YYYY-MM-DD') first_month, to_char(date_trunc('month', timezone('Asia/Seoul', now())) - interval '2 months','YYYY-MM-DD') second_month")).rows[0]
  const ym = months.first_month.replaceAll('-', '').slice(0, 6)
  const days = new Date(Date.UTC(Number(ym.slice(0,4)), Number(ym.slice(4)), 0)).getUTCDate()
  const rpc = async (name, args) => (await db.query(
    `select public.${name}(${Object.keys(args).map((key,index)=>`${key} => $${index+1}`).join(',')}) value`,
    Object.entries(args).map(([key,value]) => key === 'p_months' ? `{${value.join(',')}}` : typeof value === 'object' ? JSON.stringify(value) : value),
  )).rows[0].value
  const owner = randomUUID(), other = randomUUID()
  await db.exec('set role service_role')
  assert.equal((await rpc('visitor_collection_claim',{p_month:months.first_month,p_owner_token:owner})).state,'claimed')
  assert.equal((await rpc('visitor_collection_claim',{p_month:months.first_month,p_owner_token:other})).state,'generating')
  assert.equal((await rpc('visitor_collection_claim',{p_month:months.second_month,p_owner_token:other})).state,'busy')
  const row = {region_id:'seoul',district_id:'11110',base_month:months.first_month,
    local_visitors:10,outside_visitors:20,foreign_visitors:30,total_visitors:60,
    complete:true,observed_days:days,expected_days:days,
    through_date:`${ym.slice(0,4)}-${ym.slice(4)}-${days}`,source_fetched_at:new Date(Date.now()-1000).toISOString()}
  const finished = await rpc('visitor_collection_finish',{p_month:months.first_month,p_owner_token:owner,p_rows:[row]})
  assert.equal(finished.state,'completed')
  await db.exec('reset role')
  assert.equal((await db.query('select count(*)::int count from tourism_visitor_months')).rows[0].count,1)
  await db.exec('set role service_role')
  assert.equal((await rpc('visitor_collection_get',{p_months:[months.first_month]}))[0].state,'completed')

  assert.equal((await rpc('visitor_collection_claim',{p_month:months.second_month,p_owner_token:other})).state,'claimed')
  assert.equal((await rpc('visitor_collection_fail',{p_month:months.second_month,p_owner_token:other,p_error_code:'UPSTREAM_RATE_LIMIT',p_retry_seconds:3600})).state,'failed')
  assert.equal((await rpc('visitor_collection_claim',{p_month:months.second_month,p_owner_token:owner})).state,'failed')

  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`)
    await assert.rejects(rpc('visitor_collection_get',{p_months:[months.first_month]}),/permission denied/)
    await assert.rejects(db.query('select * from tourism_visitor_collection_jobs'),/permission denied/)
  }
})
