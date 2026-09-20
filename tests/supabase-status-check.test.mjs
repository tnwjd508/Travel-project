import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('Supabase 상태 점검 SQL은 현재 빈 DB 설계에서 영구 객체를 바꾸지 않고 실행된다', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;`)
  await db.exec(await readFile(new URL('../docs/supabase-current-design.proposed.sql', import.meta.url), 'utf8'))
  const before = (await db.query("select count(*)::int count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'")).rows[0].count
  await db.exec(await readFile(new URL('../docs/supabase-current-status-check.sql', import.meta.url), 'utf8'))
  const tables = (await db.query('select * from travel_table_status order by table_name')).rows
  assert.equal(tables.length, 11)
  assert.ok(tables.every(row => row.object_exists && row.rls_enabled && Number(row.exact_rows) === 0))
  const functions = (await db.query('select * from travel_function_status')).rows
  assert.ok(functions.every(row => row.object_exists))
  const after = (await db.query("select count(*)::int count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'")).rows[0].count
  assert.equal(after, before)
})
