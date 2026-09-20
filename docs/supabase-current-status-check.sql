-- Travel-project Supabase current-state audit.
-- Safe to run in Supabase SQL Editor: reads public objects and uses pg_temp tables only.
-- No permanent table, function, policy, row, auth user, or storage object is changed.

drop table if exists pg_temp.travel_table_status;
drop table if exists pg_temp.travel_function_status;
drop table if exists pg_temp.travel_data_status;

create temporary table travel_table_status (
  table_name text primary key,
  object_exists boolean not null,
  rls_enabled boolean,
  exact_rows bigint,
  total_bytes bigint
);

create temporary table travel_function_status (
  function_name text not null,
  arguments text not null default '',
  object_exists boolean not null,
  security_definer boolean,
  anon_can_execute boolean,
  authenticated_can_execute boolean,
  service_role_can_execute boolean
);

create temporary table travel_data_status (
  category text not null,
  item_key text not null,
  row_count bigint not null,
  complete_count bigint,
  oldest_source timestamptz,
  newest_source timestamptz
);

do $$
declare
  expected_table text;
  expected_function text;
  table_rows bigint;
  table_bytes bigint;
  table_rls boolean;
  function_count integer;
  function_row record;
begin
  foreach expected_table in array array[
    'monthly_briefings',
    'monthly_briefing_jobs',
    'organizations',
    'organization_members',
    'simulation_scenarios',
    'policy_evidence_releases',
    'policy_evidence_statistics',
    'scenario_reviews',
    'tourism_visitor_months',
    'tourism_api_cache',
    'tourism_visitor_collection_jobs'
  ] loop
    if to_regclass(format('public.%I', expected_table)) is null then
      insert into travel_table_status(table_name, object_exists)
      values (expected_table, false);
    else
      execute format('select count(*)::bigint from public.%I', expected_table)
      into table_rows;
      select c.relrowsecurity,
             pg_total_relation_size(c.oid)
      into table_rls, table_bytes
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = expected_table and c.relkind = 'r';
      insert into travel_table_status(table_name, object_exists, rls_enabled, exact_rows, total_bytes)
      values (expected_table, true, table_rls, table_rows, table_bytes);
    end if;
  end loop;

  foreach expected_function in array array[
    'briefing_get',
    'briefing_claim',
    'briefing_finish',
    'briefing_fail',
    'scenario_save',
    'import_policy_evidence',
    'save_scenario_review',
    'review_contract',
    'visitor_months_get',
    'visitor_months_store',
    'tourism_cache_get',
    'tourism_cache_store',
    'visitor_collection_get',
    'visitor_collection_claim',
    'visitor_collection_finish',
    'visitor_collection_fail'
  ] loop
    function_count := 0;
    for function_row in
      select p.oid,
             p.prosecdef,
             pg_get_function_identity_arguments(p.oid) as arguments
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = expected_function
      order by pg_get_function_identity_arguments(p.oid)
    loop
      function_count := function_count + 1;
      insert into travel_function_status(
        function_name, arguments, object_exists, security_definer,
        anon_can_execute, authenticated_can_execute, service_role_can_execute
      ) values (
        expected_function,
        function_row.arguments,
        true,
        function_row.prosecdef,
        has_function_privilege('anon', function_row.oid, 'EXECUTE'),
        has_function_privilege('authenticated', function_row.oid, 'EXECUTE'),
        has_function_privilege('service_role', function_row.oid, 'EXECUTE')
      );
    end loop;
    if function_count = 0 then
      insert into travel_function_status(function_name, object_exists)
      values (expected_function, false);
    end if;
  end loop;

  if to_regclass('public.monthly_briefings') is not null then
    execute $sql$
      insert into travel_data_status(category, item_key, row_count, complete_count, oldest_source, newest_source)
      select 'monthly_briefings', region_id || '/' || district_id,
             count(*)::bigint,
             count(*) filter (where ai_status in ('ready', 'partial'))::bigint,
             min(generated_at), max(generated_at)
      from public.monthly_briefings
      group by region_id, district_id
    $sql$;
  end if;

  if to_regclass('public.monthly_briefing_jobs') is not null then
    execute $sql$
      insert into travel_data_status(category, item_key, row_count, complete_count, oldest_source, newest_source)
      select 'monthly_briefing_jobs', status,
             count(*)::bigint,
             count(*) filter (where status = 'completed')::bigint,
             min(started_at), max(coalesce(finished_at, started_at))
      from public.monthly_briefing_jobs
      group by status
    $sql$;
  end if;

  if to_regclass('public.tourism_visitor_months') is not null then
    execute $sql$
      insert into travel_data_status(category, item_key, row_count, complete_count, oldest_source, newest_source)
      select 'tourism_visitor_months', to_char(base_month, 'YYYY-MM'),
             count(*)::bigint,
             count(*) filter (where complete)::bigint,
             min(source_fetched_at), max(source_fetched_at)
      from public.tourism_visitor_months
      group by base_month
    $sql$;
  end if;

  if to_regclass('public.tourism_api_cache') is not null then
    execute $sql$
      insert into travel_data_status(category, item_key, row_count, complete_count, oldest_source, newest_source)
      select 'tourism_api_cache', operation,
             count(*)::bigint,
             null::bigint,
             min(source_fetched_at), max(source_fetched_at)
      from public.tourism_api_cache
      group by operation
    $sql$;
  end if;

  if to_regclass('public.tourism_visitor_collection_jobs') is not null then
    execute $sql$
      insert into travel_data_status(category, item_key, row_count, complete_count, oldest_source, newest_source)
      select 'tourism_visitor_collection_jobs', status,
             count(*)::bigint,
             count(*) filter (where status = 'completed')::bigint,
             min(started_at), max(coalesce(finished_at, started_at))
      from public.tourism_visitor_collection_jobs
      group by status
    $sql$;
  end if;
end;
$$;

-- 1. Expected tables, exact row counts, RLS and total relation size.
select table_name, object_exists, rls_enabled, exact_rows,
       pg_size_pretty(total_bytes) as total_size
from travel_table_status
order by table_name;

-- 2. Required RPCs and role privileges.
-- Expected for server-only RPCs: anon=false, authenticated=false, service_role=true.
select function_name, arguments, object_exists, security_definer,
       anon_can_execute, authenticated_can_execute, service_role_can_execute
from travel_function_status
order by function_name, arguments;

-- 3. Stored briefing/cache coverage. Empty result means the tables exist but contain no matching rows.
select category, item_key, row_count, complete_count, oldest_source, newest_source
from travel_data_status
order by category, item_key;

-- 4. One compact report for copying back into the conversation.
select jsonb_pretty(jsonb_build_object(
  'checkedAt', now(),
  'missingTables', coalesce((
    select jsonb_agg(table_name order by table_name)
    from travel_table_status where not object_exists
  ), '[]'::jsonb),
  'tablesWithoutRls', coalesce((
    select jsonb_agg(table_name order by table_name)
    from travel_table_status where object_exists and not rls_enabled
  ), '[]'::jsonb),
  'missingFunctions', coalesce((
    select jsonb_agg(function_name order by function_name)
    from travel_function_status where not object_exists
  ), '[]'::jsonb),
  'browserExecutableServerFunctions', coalesce((
    select jsonb_agg(jsonb_build_object('name', function_name, 'arguments', arguments)
      order by function_name, arguments)
    from travel_function_status
    where object_exists and (anon_can_execute or authenticated_can_execute)
  ), '[]'::jsonb),
  'tableRows', coalesce((
    select jsonb_object_agg(table_name, exact_rows order by table_name)
    from travel_table_status where object_exists
  ), '{}'::jsonb),
  'dataCoverage', coalesce((
    select jsonb_agg(jsonb_build_object(
      'category', category,
      'key', item_key,
      'rows', row_count,
      'complete', complete_count,
      'oldestSource', oldest_source,
      'newestSource', newest_source
    ) order by category, item_key)
    from travel_data_status
  ), '[]'::jsonb)
)) as database_status_report;
