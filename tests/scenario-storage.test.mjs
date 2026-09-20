import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'

const user = '00000000-0000-4000-8000-000000000001'
const viewer = '00000000-0000-4000-8000-000000000002'
const outsider = '00000000-0000-4000-8000-000000000003'
const org = '00000000-0000-4000-8000-000000000011'
const other = '00000000-0000-4000-8000-000000000012'
const key = '00000000-0000-4000-8000-000000000021'

export async function database() {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    insert into auth.users values ('${user}'),('${viewer}'),('${outsider}');`)
  const dir = new URL('../supabase/migrations/', import.meta.url)
  for (const file of (await readdir(dir)).filter(file => file.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'))
  }
  await db.exec(`insert into organizations(id,name) values ('${org}','기관 A'),('${other}','기관 B');
    insert into organization_members(organization_id,user_id,role) values
    ('${org}','${user}','editor'),('${org}','${viewer}','viewer'),('${other}','${outsider}','admin');`)
  return db
}

test('통합 Supabase: 기관 저장·멱등성·RLS·브리핑 참조', async t => {
  const db = await database()
  t.after(() => db.close())
  async function save(overrides = {}) {
    const args = { p_organization_id: org, p_user_id: user, p_idempotency_key: key, p_request_sha256: 'a'.repeat(64),
      p_region_id: 'jeonnam-gwangju', p_district_id: '12210', p_district_name: '동구', p_catalogue_version: 'test',
      p_policy_code: 'night', p_policy_name: '야간관광 확대', p_budget_krw: 1500000000, p_start_month: '2026-10-01',
      p_duration_months: 12, p_briefing_month: null, ...overrides }
    return (await db.query(`select scenario_save(${Object.keys(args).map((key,i) => `${key} => $${i+1}`).join(',')}) as result`, Object.values(args))).rows[0].result
  }
  let saved
  await t.test('서버 전용 RPC로 실제 입력을 저장하고 동일 요청은 같은 행을 반환', async () => {
    await db.exec('set role service_role')
    saved = await save()
    assert.equal(saved.budget_krw, 1500000000)
    assert.equal(saved.duration_months, 12)
    assert.equal((await save()).id, saved.id)
    await assert.rejects(save({ p_request_sha256: 'b'.repeat(64) }), /IDEMPOTENCY_CONFLICT/)
    await assert.rejects(db.query('select * from simulation_scenarios'), /permission denied/)
    await db.exec('reset role')
  })
  await t.test('viewer·다른 기관 사용자의 저장 차단', async () => {
    await assert.rejects(save({ p_user_id: viewer }), /SCENARIO_FORBIDDEN/)
    await assert.rejects(save({ p_user_id: outsider }), /SCENARIO_FORBIDDEN/)
  })
  await t.test('회원은 기관 기록을 공동 조회하고 외부 사용자는 0행', async () => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${viewer}',false)`)
    assert.equal((await db.query('select id from simulation_scenarios')).rows.length, 1)
    await assert.rejects(save(), /permission denied/)
    await assert.rejects(db.query('delete from simulation_scenarios'), /permission denied/)
    await db.exec(`select set_config('request.jwt.claim.sub','${outsider}',false)`)
    assert.equal((await db.query('select id from simulation_scenarios')).rows.length, 0)
    await assert.rejects(db.query('select * from monthly_briefings'), /permission denied/)
    await db.exec('reset role')
  })
  await t.test('소속 제거 즉시 이전 JWT의 읽기와 쓰기를 차단', async () => {
    await db.exec(`delete from organization_members where user_id='${viewer}';
      set role authenticated; select set_config('request.jwt.claim.sub','${viewer}',false)`)
    assert.equal((await db.query('select id from simulation_scenarios')).rows.length, 0)
    await db.exec('reset role')
    await assert.rejects(save({ p_user_id: viewer }), /SCENARIO_FORBIDDEN/)
  })
  await t.test('없는 월·다른 지역 브리핑 참조 차단, 같은 지역의 원본 재사용', async () => {
    const newKey = '00000000-0000-4000-8000-000000000022'
    await assert.rejects(save({ p_idempotency_key: newKey, p_briefing_month: '2026-08-01' }), /foreign key/)
    await db.exec(`insert into monthly_briefings(region_id,district_id,analysis_month,payload,ai_status,generated_at,festival_as_of,model_name)
      values ('jeonnam-gwangju','12210','2026-08-01','{"district":"12210","month":"2026-08","aiStatus":"ready","diagnosis":{}}','ready',now(),'2026-09-19','test');`)
    assert.equal((await save({ p_idempotency_key: newKey, p_briefing_month: '2026-08-01' })).briefing_month, '2026-08-01')
    await assert.rejects(save({ p_idempotency_key: '00000000-0000-4000-8000-000000000023', p_district_id: '12220', p_briefing_month: '2026-08-01' }), /foreign key/)
    await assert.rejects(db.exec('delete from monthly_briefings'), /변경하거나 삭제/)
  })
  await t.test('계정 삭제 후에도 기관 기록 보존', async () => {
    await db.exec(`delete from auth.users where id='${user}'`)
    assert.equal((await db.query('select created_by from simulation_scenarios where id=$1',[saved.id])).rows[0].created_by, null)
  })
})

test('미래 모델 실행 설계는 공통 스키마와 중복 없이 결합된다', async t => {
  const db = await database()
  t.after(() => db.close())
  await db.exec(await readFile(new URL('../docs/supabase-simulation-schema.proposed.sql', import.meta.url), 'utf8'))
  const model = '00000000-0000-4000-8000-000000000041'
  const run = '00000000-0000-4000-8000-000000000031'
  const otherRun = '00000000-0000-4000-8000-000000000032'
  await db.exec(`insert into simulation_model_versions(id,model_name,version,manifest,manifest_sha256)
    values ('${model}','test-only','test','{}',repeat('a',64));
    insert into simulation_runs(id,organization_id,title,region_id,district_id,district_name,catalogue_version,
      policy_code,policy_name,budget_krw,start_month,duration_months,model_version_id,idempotency_key,request_sha256)
    values ('${run}','${org}','테스트','jeonnam-gwangju','12210','동구','test','night','야간',1500000000,'2026-10-01',12,'${model}','${key}',repeat('a',64)),
    ('${otherRun}','${other}','테스트','jeonnam-gwangju','12210','동구','test','night','야간',1500000000,'2026-10-01',12,'${model}','${key}',repeat('a',64));
    insert into simulation_results(run_id,summary) values ('${run}','수치 산출 불가'),('${otherRun}','수치 산출 불가');`)
  await t.test('조회 토큰으로 같은 기관 결과만 읽고 워커 토큰은 읽지 못한다', async () => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false)`)
    assert.equal((await db.query('select run_id from simulation_results')).rows.length, 1)
    assert.equal((await db.query('select id from simulation_runs')).rows.length, 1)
    await assert.rejects(db.query('select worker_token from simulation_runs'), /permission denied/)
    await db.exec('reset role')
  })
  await t.test('기관이 다른 부모 실행 참조를 거절한다', async () => {
    await assert.rejects(db.query('update simulation_runs set parent_run_id=$1 where id=$2', [otherRun,run]), /foreign key/)
  })
  await t.test('결측 효과 NULL 허용, NaN 수치와 잘못된 효과 선언은 거절한다', async () => {
    await db.query("insert into simulation_result_metrics(run_id,metric_key,horizon_month,unit,aggregation,unavailable_reason) values ($1,'missing',0,'index','mean','자료 부족')",[run])
    await assert.rejects(db.query("update simulation_result_metrics set effect_type='scenario_difference' where run_id=$1",[run]), /check constraint/)
    await assert.rejects(db.query("update simulation_result_metrics set observed_value='NaN' where run_id=$1",[run]), /check constraint/)
  })
  await t.test('취소 사유·시각을 필수로 기록한다', async () => {
    await assert.rejects(db.query("update simulation_runs set status='cancelled',finished_at=now() where id=$1",[run]), /check constraint/)
    await db.query("update simulation_runs set status='cancelled',finished_at=now(),cancelled_at=now(),cancel_reason='사용자 요청' where id=$1",[run])
  })
  await t.test('입력 스냅샷은 run과 지역이 일치해야 한다', async () => {
    await assert.rejects(db.query(`insert into simulation_input_snapshots(run_id,region_id,district_id,source_key,source_name,
      temporal_basis,as_of_date,fetched_at,completeness,payload,payload_sha256)
      values ($1,'seoul','11110','test','test','as_of',current_date,now(),'unavailable','{}',repeat('a',64))`,[run]), /foreign key/)
  })
})
