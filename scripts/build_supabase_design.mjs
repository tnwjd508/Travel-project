// Build/check the empty-database design bundle. Does not connect to Supabase.
import { readFile, writeFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const files = [
  'supabase/migrations/001_monthly_briefings.sql',
  'supabase/migrations/002_monthly_briefing_jobs.sql',
  'supabase/migrations/20260919115012_organization_scenarios.sql',
  'docs/supabase-evidence-extension.proposed.sql',
]
const parts = []
for (const file of files) {
  const sql = (await readFile(new URL(file, root), 'utf8')).replace(/\r\n/g, '\n').trim()
  if ((sql.match(/^begin;$/gm) ?? []).length !== 1 || !sql.endsWith('commit;')) throw new Error(`Unexpected transaction wrapper: ${file}`)
  parts.push(`-- Source: ${file}\n${sql.replace(/^begin;\n/m, '').replace(/commit;$/, '').trim()}`)
}
const bundle = `-- 2026-09-20: Travel-project current database design (8 service tables).
-- EMPTY DATABASE ONLY. Review docs/supabase-database-design.md before deployment.
-- Preserves existing briefing contracts. New review endpoints are not implemented.
-- No DROP/DELETE, remote execution or production data seeds.
-- Generated: node scripts/build_supabase_design.mjs (do not edit this copy).
begin;
${parts.join('\n\n')}
commit;
`
const target = new URL('docs/supabase-current-design.proposed.sql', root)
if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')).replace(/\r\n/g, '\n') !== bundle) throw new Error('Design bundle is stale; regenerate it.')
  console.log('Design bundle matches all four source SQL files.')
} else {
  await writeFile(target, bundle, 'utf8')
  console.log('Generated docs/supabase-current-design.proposed.sql (no database connection).')
}
