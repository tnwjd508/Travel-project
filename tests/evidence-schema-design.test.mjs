// Schema proposal validation, not an application implementation or remote DB test.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const commit = 'f25dc8673420c451d3fdb4482fce5feb00a485f1'
const artifact = await readFile(new URL('./fixtures/festival-evidence-v1.json', import.meta.url))
const payload = JSON.parse(artifact)
const sha = createHash('sha256').update(artifact).digest('hex')

test('2026-09-20 evidence schema: real checked-in artifact, shared evidence, private reviews', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  const user = randomUUID(), viewer = randomUUID(), outsider = randomUUID(), org = randomUUID(), other = randomUUID()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;`)
  for (const file of ['001_monthly_briefings.sql','002_monthly_briefing_jobs.sql','20260919115012_organization_scenarios.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url),'utf8'))
  }
  await db.exec(await readFile(new URL('../docs/supabase-evidence-extension.proposed.sql', import.meta.url),'utf8'))
  await db.query('insert into auth.users values ($1),($2),($3)',[user,viewer,outsider])
  await db.query("insert into organizations(id,name) values ($1,'A'),($2,'B')",[org,other])
  await db.query("insert into organization_members(organization_id,user_id,role) values ($1,$2,'editor'),($1,$3,'viewer'),($4,$5,'editor')",[org,user,viewer,other,outsider])
  async function rpc(name, args) {
    return (await db.query(`select public.${name}(${Object.keys(args).map((key,i) => `${key} => $${i+1}`).join(',')}) as value`,Object.values(args))).rows[0].value
  }
  async function makeScenario(policy = 'festival', district = '12210', budget = 1500000000, duration = 6) {
    return rpc('scenario_save',{p_organization_id:org,p_user_id:user,p_idempotency_key:randomUUID(),p_request_sha256:'a'.repeat(64),
      p_region_id:district==='11110'?'seoul':'jeonnam-gwangju',p_district_id:district,p_district_name:'시험 지역',p_catalogue_version:'test',
      p_policy_code:policy,p_policy_name:policy,p_budget_krw:budget,p_start_month:'2026-10-01',p_duration_months:duration})
  }
  let release, scenario, review
  const snapshot = { summary:null, diagnosis:null, capturedAt:'2026-09-20T00:00:00Z',request:{regionId:'jeonnam-gwangju',districtId:'12210'} }
  const reviewKey = randomUUID()
  const reviewArgs = () => ({p_organization_id:org,p_scenario_id:scenario.id,p_user_id:user,p_idempotency_key:reviewKey,
    p_request_sha256:'a'.repeat(64),p_baseline_status:'unavailable',p_baseline_snapshot:snapshot,p_evidence_release_id:release})
  const importArgs = () => ({p_payload:payload,p_artifact_sha256:sha,p_repository_commit:commit})
  await t.test('same artifact imports once; all 12 statistics match its authoritative JSON', async () => {
    await db.exec('set role service_role')
    release = await rpc('import_policy_evidence',importArgs())
    assert.equal(await rpc('import_policy_evidence',importArgs()),release)
    const rows = (await db.query('select * from policy_evidence_statistics where release_id=$1',[release])).rows
    assert.equal(rows.length,12)
    for (const row of rows) {
      const source = payload[row.outcome][row.segment]
      assert.equal(row.sample_count,source.n)
      assert.equal(Number(row.mean_pct),source.meanPct)
      assert.equal(Number(row.median_pct),source.medianPct)
      assert.equal(Number(row.ci_lower_pct),source.ci95Pct[0])
      assert.equal(Number(row.ci_upper_pct),source.ci95Pct[1])
      assert.equal(Number(row.share_positive),source.sharePositive)
    }
    assert.equal((await db.query('select provenance_status from policy_evidence_releases where id=$1',[release])).rows[0].provenance_status,'partial')
  })
  await t.test('hash conflicts and malformed imports cannot leave partial releases', async () => {
    await assert.rejects(rpc('import_policy_evidence',{...importArgs(),p_payload:{...payload,method:'changed'}}),/ARTIFACT_HASH_CONFLICT/)
    const broken = structuredClone(payload); broken.outside.metroGu.ci95Pct=[5,1]
    await assert.rejects(rpc('import_policy_evidence',{...importArgs(),p_payload:broken,p_artifact_sha256:'b'.repeat(64)}),/check constraint/)
    assert.equal((await db.query('select count(*)::int as n from policy_evidence_releases')).rows[0].n,1)
    await assert.rejects(rpc('import_policy_evidence',{...importArgs(),p_repository_commit:'c'.repeat(40)}),/ARTIFACT_HASH_CONFLICT/)
    await assert.rejects(rpc('import_policy_evidence',{...importArgs(),p_provenance:{note:'different'}}),/ARTIFACT_HASH_CONFLICT/)
  })
  await t.test('later provenance evidence creates a new immutable revision of the same artifact', async () => {
    const provenance = { producer_commit:commit,parameters:{seed:42},runtime:{python:'test-runtime'},
      raw_artifacts:[{storage_path:'private-evidence/test.csv.gz',sha256:'d'.repeat(64),source_name:'test fixture',fetched_at:'2026-09-19T00:00:00Z'}] }
    await assert.rejects(rpc('import_policy_evidence',{...importArgs(),p_provenance_revision:2,p_provenance_status:'complete',p_provenance:{...provenance,raw_artifacts:[null]}}),/INVALID_PROVENANCE/)
    const second = await rpc('import_policy_evidence',{...importArgs(),p_provenance_revision:2,p_provenance_status:'complete',p_provenance:provenance})
    assert.notEqual(second,release)
    assert.equal((await db.query('select provenance_status from policy_evidence_releases where id=$1',[release])).rows[0].provenance_status,'partial')
    assert.equal((await db.query('select provenance_status from policy_evidence_releases where id=$1',[second])).rows[0].provenance_status,'complete')
  })
  await t.test('festival review freezes baseline and refers to 271 historical cases; retries reuse it', async () => {
    scenario = await makeScenario()
    review = await rpc('save_scenario_review',reviewArgs())
    assert.equal(review.reference_status,'available')
    assert.deepEqual(review.baseline_snapshot,snapshot)
    assert.equal((await rpc('save_scenario_review',reviewArgs())).id,review.id)
    await assert.rejects(rpc('save_scenario_review',{...reviewArgs(),p_request_sha256:'c'.repeat(64)}),/IDEMPOTENCY_CONFLICT/)
    const stat = (await db.query('select sample_count,mean_pct,ci_lower_pct from policy_evidence_statistics where id=$1',[review.evidence_statistic_id])).rows[0]
    assert.equal(stat.sample_count,271); assert.equal(Number(stat.mean_pct),1.7); assert.equal(Number(stat.ci_lower_pct),0.7)
  })
  await t.test('changing budget/duration never scales the historical estimate', async () => {
    const another = await makeScenario('festival','12210',5000000000,12)
    const result = await rpc('save_scenario_review',{...reviewArgs(),p_scenario_id:another.id,p_idempotency_key:randomUUID()})
    assert.equal(result.evidence_statistic_id,review.evidence_statistic_id)
  })
  await t.test('baseline status, canonical region and capture time cannot contradict the saved scenario', async () => {
    await assert.rejects(rpc('save_scenario_review',{...reviewArgs(),p_idempotency_key:randomUUID(),p_baseline_status:'complete'}),/check constraint/)
    for (const invalid of [{...snapshot,capturedAt:null},{...snapshot,capturedAt:'2026-13-01T00:00:00Z'},
      {...snapshot,request:{regionId:'seoul',districtId:'11110'}},
      {...snapshot,summary:{district:'11110',baseYm:'202608',fetchedAt:'2026-09-20T00:00:00Z'}}]) {
      await assert.rejects(rpc('save_scenario_review',{...reviewArgs(),p_idempotency_key:randomUUID(),p_baseline_snapshot:invalid}))
    }
    const data = {district:'12210',baseYm:'202608',fetchedAt:'2026-09-20T00:00:00Z'}
    const result = await rpc('save_scenario_review',{...reviewArgs(),p_idempotency_key:randomUUID(),p_baseline_status:'partial',p_baseline_snapshot:{...snapshot,summary:data}})
    assert.equal(result.baseline_status,'partial')
  })
  await t.test('night evidence with a negative interval lower bound remains insufficient', async () => {
    const night = await makeScenario('night')
    const result = await rpc('save_scenario_review',{...reviewArgs(),p_scenario_id:night.id,p_idempotency_key:randomUUID()})
    assert.equal(result.reference_status,'insufficient_evidence')
    assert.ok(result.evidence_statistic_id)
  })
  await t.test('unsupported policy, out-of-scope county and unimported evidence have no fabricated values', async () => {
    for (const [policy,district,expected] of [['shuttle','12210','unsupported_policy'],['festival','12710','out_of_scope'],['festival','11110','available']]) {
      const target = await makeScenario(policy,district)
      const result = await rpc('save_scenario_review',{...reviewArgs(),p_scenario_id:target.id,p_idempotency_key:randomUUID(),
        p_baseline_snapshot:{...snapshot,request:{regionId:target.region_id,districtId:target.district_id}}})
      assert.equal(result.reference_status,expected)
    }
    const result = await rpc('save_scenario_review',{...reviewArgs(),p_idempotency_key:randomUUID(),p_evidence_release_id:null})
    assert.equal(result.reference_status,'not_imported'); assert.equal(result.evidence_statistic_id,null)
  })
  await t.test('viewer and other organization cannot save reviews', async () => {
    await assert.rejects(rpc('save_scenario_review',{...reviewArgs(),p_user_id:viewer}),/REVIEW_FORBIDDEN/)
    await assert.rejects(rpc('save_scenario_review',{...reviewArgs(),p_user_id:outsider,p_organization_id:other,p_idempotency_key:randomUUID()}),/SCENARIO_NOT_ACCESSIBLE/)
  })
  await t.test('RLS limits review reads and denies browser imports or result writes', async () => {
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${viewer}',false)`)
    assert.ok((await db.query('select id from scenario_reviews')).rows.length>0)
    await assert.rejects(rpc('import_policy_evidence',importArgs()),/permission denied/)
    await assert.rejects(db.query('select * from policy_evidence_releases'),/permission denied/)
    await assert.rejects(db.query('delete from scenario_reviews'),/permission denied/)
    await db.exec(`select set_config('request.jwt.claim.sub','${outsider}',false)`)
    assert.equal((await db.query('select id from scenario_reviews')).rows.length,0)
    await db.exec('reset role')
  })
  await t.test('stored evidence and reviews are immutable, but deleting the author preserves review history', async () => {
    await assert.rejects(db.query("update scenario_reviews set reference_status='not_imported',evidence_statistic_id=null where id=$1",[review.id]),/immutable/)
    await assert.rejects(db.query("update policy_evidence_statistics set mean_pct=99 where release_id=$1",[release]),/immutable/)
    await db.query('delete from auth.users where id=$1',[user])
    assert.equal((await db.query('select created_by from scenario_reviews where id=$1',[review.id])).rows[0].created_by,null)
  })
})
