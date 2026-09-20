-- 2026-09-20: Travel-project current database design (10 service tables).
-- EMPTY DATABASE ONLY. Review docs/supabase-database-design.md before deployment.
-- Preserves existing briefing contracts. Matches backend/reviews.py.
-- No DROP/DELETE, remote execution or production data seeds.
-- Generated: node scripts/build_supabase_design.mjs (do not edit this copy).
begin;
-- Source: supabase/migrations/001_monthly_briefings.sql
-- 지역·진단 월마다 확정 결과를 하나만 저장합니다. 날짜가 바뀌어도 만료되지 않습니다.
create table public.monthly_briefings (
  id uuid primary key default gen_random_uuid(),
  region_id text not null,
  district_id text not null,
  analysis_month date not null check (extract(day from analysis_month) = 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  ai_status text not null check (ai_status in ('ready', 'partial')),
  generated_at timestamptz not null,
  saved_at timestamptz not null default now(),
  festival_as_of date not null,
  model_name text not null,
  schema_version integer not null default 1 check (schema_version = 1),
  unique (region_id, district_id, analysis_month),
  check (payload->>'district' = district_id),
  check (payload->>'month' = to_char(analysis_month, 'YYYY-MM')),
  check (payload->>'aiStatus' = ai_status),
  check (jsonb_typeof(payload->'diagnosis') = 'object')
);

-- 실패 기록도 남겨 새로고침이나 서버 재시작으로 AI가 반복 실행되지 않게 합니다.
create table public.monthly_briefing_jobs (
  region_id text not null,
  district_id text not null,
  analysis_month date not null check (extract(day from analysis_month) = 1),
  status text not null check (status in ('generating', 'completed', 'failed', 'interrupted')),
  owner_token uuid not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  finished_at timestamptz,
  error_code text check (error_code in ('AI_UNAVAILABLE', 'GENERATION_FAILED', 'INTERRUPTED')),
  source_snapshot jsonb,
  primary key (region_id, district_id, analysis_month)
);
create index monthly_briefing_jobs_active on public.monthly_briefing_jobs (deadline_at) where status = 'generating';
create index monthly_briefing_jobs_started on public.monthly_briefing_jobs (started_at);

-- 확정 결과는 실수로 갱신하거나 삭제하는 것까지 DB에서 차단합니다.
create function public.protect_monthly_briefing() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '저장된 월간 브리핑은 변경하거나 삭제할 수 없습니다.';
end;
$$;
create trigger monthly_briefings_immutable before update or delete on public.monthly_briefings
for each row execute function public.protect_monthly_briefing();

alter table public.monthly_briefings enable row level security;
alter table public.monthly_briefing_jobs enable row level security;
-- 서버도 테이블을 직접 변경하지 않고 다음 마이그레이션의 제한된 함수만 사용합니다.
revoke all on public.monthly_briefings, public.monthly_briefing_jobs from public, anon, authenticated, service_role;
revoke all on function public.protect_monthly_briefing() from public, anon, authenticated, service_role;

-- Source: supabase/migrations/002_monthly_briefing_jobs.sql
-- 조회는 쓰기 없이 저장 결과와 작업 상태만 반환합니다. 만료된 작업을 재선점하지 않습니다.
create function public.briefing_get(p_region_id text, p_district_id text, p_month date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result public.monthly_briefings%rowtype;
  job public.monthly_briefing_jobs%rowtype;
begin
  select * into result from public.monthly_briefings
    where region_id = p_region_id and district_id = p_district_id and analysis_month = p_month;
  if found then
    return jsonb_build_object('state', 'stored', 'data', result.payload, 'savedAt', result.saved_at);
  end if;
  select * into job from public.monthly_briefing_jobs
    where region_id = p_region_id and district_id = p_district_id and analysis_month = p_month;
  if not found then return jsonb_build_object('state', 'missing'); end if;
  if job.status = 'generating' and job.deadline_at > clock_timestamp() then
    return jsonb_build_object('state', 'generating');
  end if;
  return jsonb_build_object('state', case when job.status = 'failed' then 'failed' else 'interrupted' end,
    'errorCode', coalesce(job.error_code, 'INTERRUPTED'), 'snapshot', job.source_snapshot);
end;
$$;

create function public.briefing_claim(p_region_id text, p_district_id text, p_month date, p_owner_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_state jsonb;
  current_month date := date_trunc('month', timezone('Asia/Seoul', clock_timestamp()))::date;
begin
  if p_region_id is null or p_region_id !~ '^[a-z][a-z-]{1,40}$'
    or p_district_id is null or p_district_id !~ '^[0-9]{5}$'
    or p_owner_token is null or p_month is null or extract(day from p_month) <> 1
    or p_month >= current_month or p_month < current_month - interval '24 months' then
    raise exception '유효하지 않은 생성 조건입니다.';
  end if;
  -- 여러 Vercel 인스턴스가 동시에 와도 작업 등록과 전체 개수 확인은 직렬 처리합니다.
  -- 이 잠금은 짧은 DB 트랜잭션 동안만 유지되고 외부 API를 호출하기 전에 풀립니다.
  perform pg_advisory_xact_lock(7019260919);
  current_state := public.briefing_get(p_region_id, p_district_id, p_month);
  if current_state->>'state' <> 'missing' then return current_state; end if;
  if (select count(*) from public.monthly_briefing_jobs where status = 'generating' and deadline_at > clock_timestamp()) >= 2
    or (select count(*) from public.monthly_briefing_jobs where started_at > clock_timestamp() - interval '1 minute') >= 6 then
    return jsonb_build_object('state', 'busy');
  end if;
  insert into public.monthly_briefing_jobs(region_id, district_id, analysis_month, status, owner_token, deadline_at)
    values (p_region_id, p_district_id, p_month, 'generating', p_owner_token, clock_timestamp() + interval '280 seconds');
  return jsonb_build_object('state', 'claimed');
end;
$$;

create function public.briefing_finish(p_region_id text, p_district_id text, p_month date,
  p_owner_token uuid, p_payload jsonb, p_model text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  job public.monthly_briefing_jobs%rowtype;
begin
  select * into job from public.monthly_briefing_jobs
    where region_id = p_region_id and district_id = p_district_id and analysis_month = p_month for update;
  if not found or job.owner_token is distinct from p_owner_token then raise exception '생성 권한이 일치하지 않습니다.'; end if;
  -- 저장은 성공했지만 HTTP 응답이 유실된 경우, 같은 소유자의 저장 재시도를 안전하게 처리합니다.
  if job.status = 'completed' then return public.briefing_get(p_region_id, p_district_id, p_month); end if;
  if job.status <> 'generating' or job.deadline_at <= clock_timestamp() then raise exception '생성 작업이 종료되었습니다.'; end if;
  if p_payload is null or (p_payload->>'district') is distinct from p_district_id
    or (p_payload->>'month') is distinct from to_char(p_month, 'YYYY-MM')
    or coalesce(p_payload->>'aiStatus', '') not in ('ready', 'partial')
    or jsonb_typeof(p_payload->'diagnosis') is distinct from 'object' then raise exception '저장 결과가 유효하지 않습니다.'; end if;
  insert into public.monthly_briefings(region_id, district_id, analysis_month, payload, ai_status, generated_at, festival_as_of, model_name)
    values(p_region_id, p_district_id, p_month, p_payload, p_payload->>'aiStatus',
      (p_payload->>'generatedAt')::timestamptz, (p_payload->>'festivalAsOf')::date, p_model);
  update public.monthly_briefing_jobs set status = 'completed', finished_at = clock_timestamp()
    where region_id = p_region_id and district_id = p_district_id and analysis_month = p_month;
  return public.briefing_get(p_region_id, p_district_id, p_month);
end;
$$;

create function public.briefing_fail(p_region_id text, p_district_id text, p_month date,
  p_owner_token uuid, p_error_code text, p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_error_code is null or p_error_code not in ('AI_UNAVAILABLE', 'GENERATION_FAILED') then raise exception '잘못된 오류 코드입니다.'; end if;
  update public.monthly_briefing_jobs set status = 'failed', finished_at = clock_timestamp(),
      error_code = p_error_code, source_snapshot = p_snapshot
    where region_id = p_region_id and district_id = p_district_id and analysis_month = p_month
      and owner_token = p_owner_token and status = 'generating' and deadline_at > clock_timestamp();
  return public.briefing_get(p_region_id, p_district_id, p_month);
end;
$$;

revoke all on function public.briefing_get(text,text,date), public.briefing_claim(text,text,date,uuid),
  public.briefing_finish(text,text,date,uuid,jsonb,text), public.briefing_fail(text,text,date,uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.briefing_get(text,text,date), public.briefing_claim(text,text,date,uuid),
  public.briefing_finish(text,text,date,uuid,jsonb,text), public.briefing_fail(text,text,date,uuid,text,jsonb)
  to service_role;

-- Source: supabase/migrations/20260919115012_organization_scenarios.sql
-- Shared tenancy for monthly briefing + policy scenarios. No forecast seeds.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index idx_organization_members_user on public.organization_members(user_id, organization_id);

-- Saved inputs, not completed model runs. Every save is an immutable revision.
create table public.simulation_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 160),
  region_id text not null,
  district_id text not null check (district_id ~ '^[0-9]{5}$'),
  district_name text not null,
  catalogue_version text not null,
  policy_code text not null check (policy_code in ('night', 'festival', 'shuttle', 'market', 'art')),
  policy_name text not null,
  budget_krw bigint not null check (budget_krw between 500000000 and 5000000000 and budget_krw % 100000000 = 0),
  start_month date not null check (extract(day from start_month) = 1),
  duration_months smallint not null check (duration_months in (3, 6, 12)),
  -- Reference the existing immutable briefing instead of copying its payload.
  briefing_month date check (extract(day from briefing_month) = 1),
  idempotency_key uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, idempotency_key),
  foreign key (region_id, district_id, briefing_month)
    references public.monthly_briefings(region_id, district_id, analysis_month) on delete restrict
);
create index idx_scenarios_org_recent on public.simulation_scenarios(organization_id, created_at desc, id desc);
create index idx_scenarios_org_district on public.simulation_scenarios(organization_id, district_id, created_at desc, id desc);
create index idx_scenarios_creator on public.simulation_scenarios(created_by);
create index idx_scenarios_briefing on public.simulation_scenarios(region_id, district_id, briefing_month) where briefing_month is not null;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.simulation_scenarios enable row level security;
revoke all on public.organizations, public.organization_members, public.simulation_scenarios from public, anon, authenticated, service_role;
grant select on public.organizations, public.organization_members, public.simulation_scenarios to authenticated;
-- Membership provisioning is an operator task; never a browser write.
grant select, insert, update, delete on public.organizations, public.organization_members to service_role;

create policy members_read_own on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy organizations_read_member on public.organizations for select to authenticated using (
  id in (select organization_id from public.organization_members where user_id = (select auth.uid()))
);
create policy scenarios_read_member on public.simulation_scenarios for select to authenticated using (
  organization_id in (select organization_id from public.organization_members where user_id = (select auth.uid()))
);

-- Only FastAPI may call this, after auth.getUser verifies the caller.
-- Lock membership until commit: removal/downgrade cannot race a save.
create function public.scenario_save(
  p_organization_id uuid, p_user_id uuid, p_idempotency_key uuid, p_request_sha256 text,
  p_region_id text, p_district_id text, p_district_name text, p_catalogue_version text,
  p_policy_code text, p_policy_name text, p_budget_krw bigint, p_start_month date,
  p_duration_months smallint, p_briefing_month date default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_row public.simulation_scenarios;
begin
  select role into v_role from public.organization_members
    where organization_id = p_organization_id and user_id = p_user_id for share;
  if v_role is null or v_role not in ('admin', 'editor') then
    raise exception using errcode = '42501', message = 'SCENARIO_FORBIDDEN';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text || ':' || p_idempotency_key::text, 0));
  select * into v_row from public.simulation_scenarios
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    if v_row.request_sha256 <> p_request_sha256 then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return to_jsonb(v_row);
  end if;
  insert into public.simulation_scenarios (
    organization_id, created_by, title, region_id, district_id, district_name, catalogue_version,
    policy_code, policy_name, budget_krw, start_month, duration_months, briefing_month, idempotency_key, request_sha256
  ) values (
    p_organization_id, p_user_id,
    p_district_name || ' · ' || p_policy_name || ' · ' || (p_budget_krw / 100000000)::text || '억 원 · ' || p_duration_months::text || '개월',
    p_region_id, p_district_id, p_district_name, p_catalogue_version,
    p_policy_code, p_policy_name, p_budget_krw, p_start_month, p_duration_months, p_briefing_month, p_idempotency_key, p_request_sha256
  ) returning * into v_row;
  return to_jsonb(v_row);
end;
$$;
revoke all on function public.scenario_save(uuid,uuid,uuid,text,text,text,text,text,text,text,bigint,date,smallint,date) from public, anon, authenticated;
grant execute on function public.scenario_save(uuid,uuid,uuid,text,text,text,text,text,text,text,bigint,date,smallint,date) to service_role;

comment on table public.simulation_scenarios is 'Organization-owned saved policy inputs. Not forecast results. Server RPC is the only application write path.';

-- Source: supabase/migrations/20260920104513_tourism_visitor_month_cache.sql
-- 관광객 추이는 외부 API의 월별 전국 응답을 지자체 단위로 집계한 영속 캐시입니다.
-- AI 브리핑과 수명주기가 다르므로 monthly_briefings와 분리합니다.
create table public.tourism_visitor_months (
  region_id text not null check (region_id ~ '^[a-z][a-z-]{1,40}$'),
  district_id text not null check (district_id ~ '^[0-9]{5}$'),
  base_month date not null check (
    extract(day from base_month) = 1
    and base_month >= date '2019-01-01'
    and base_month < date_trunc('month', timezone('Asia/Seoul', now()))::date
  ),
  local_visitors numeric,
  outside_visitors numeric,
  foreign_visitors numeric,
  total_visitors numeric,
  complete boolean not null,
  observed_days smallint not null check (observed_days between 0 and 31),
  expected_days smallint not null check (
    expected_days between 28 and 31
    and expected_days = extract(day from (base_month + interval '1 month - 1 day'))
    and observed_days <= expected_days
  ),
  through_date date,
  source_fetched_at timestamptz not null check (source_fetched_at <= now() + interval '5 minutes'),
  stored_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  schema_version smallint not null default 1 check (schema_version = 1),
  primary key (region_id, district_id, base_month),
  check (
    (complete and observed_days = expected_days
      and through_date = (base_month + interval '1 month - 1 day')::date
      and local_visitors is not null and local_visitors >= 0
      and outside_visitors is not null and outside_visitors >= 0
      and foreign_visitors is not null and foreign_visitors >= 0
      and total_visitors is not null and total_visitors >= 0)
    or
    (not complete and local_visitors is null and outside_visitors is null
      and foreign_visitors is null and total_visitors is null)
  ),
  check (
    (observed_days = 0 and through_date is null)
    or
    (observed_days > 0 and through_date is not null
      and date_trunc('month', through_date)::date = base_month)
  )
);

comment on table public.tourism_visitor_months is
  'Server-only monthly aggregates of Korea Tourism Data Lab daily estimated visitors. Incomplete months retain completeness metadata and null totals.';

alter table public.tourism_visitor_months enable row level security;
revoke all on public.tourism_visitor_months from public, anon, authenticated, service_role;

create function public.visitor_months_get(
  p_region_id text,
  p_district_id text,
  p_months date[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if p_region_id is null or p_region_id !~ '^[a-z][a-z-]{1,40}$'
    or p_district_id is null or p_district_id !~ '^[0-9]{5}$'
    or p_months is null or cardinality(p_months) not between 1 and 24
    or exists (select 1 from unnest(p_months) value where value is null or extract(day from value) <> 1) then
    raise exception 'INVALID_VISITOR_CACHE_QUERY';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'ym', to_char(item.base_month, 'YYYYMM'),
    'total', item.total_visitors,
    'local', item.local_visitors,
    'outside', item.outside_visitors,
    'foreign', item.foreign_visitors,
    'complete', item.complete,
    'observedDays', item.observed_days,
    'expectedDays', item.expected_days,
    'through', to_char(item.through_date, 'YYYYMMDD'),
    'sourceFetchedAt', item.source_fetched_at
  ) order by item.base_month), '[]'::jsonb)
  into result
  from public.tourism_visitor_months item
  where item.region_id = p_region_id
    and item.district_id = p_district_id
    and item.base_month = any(p_months);

  return result;
end;
$$;

create function public.visitor_months_store(p_rows jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  changed integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) not between 1 and 400 then
    raise exception 'INVALID_VISITOR_CACHE_ROWS';
  end if;

  with parsed as (
    select * from jsonb_to_recordset(p_rows) as item(
      region_id text,
      district_id text,
      base_month date,
      local_visitors numeric,
      outside_visitors numeric,
      foreign_visitors numeric,
      total_visitors numeric,
      complete boolean,
      observed_days smallint,
      expected_days smallint,
      through_date date,
      source_fetched_at timestamptz
    )
  ), written as (
    insert into public.tourism_visitor_months as current (
      region_id, district_id, base_month,
      local_visitors, outside_visitors, foreign_visitors, total_visitors,
      complete, observed_days, expected_days, through_date, source_fetched_at
    )
    select region_id, district_id, base_month,
      local_visitors, outside_visitors, foreign_visitors, total_visitors,
      complete, observed_days, expected_days, through_date, source_fetched_at
    from parsed
    on conflict (region_id, district_id, base_month) do update set
      local_visitors = excluded.local_visitors,
      outside_visitors = excluded.outside_visitors,
      foreign_visitors = excluded.foreign_visitors,
      total_visitors = excluded.total_visitors,
      complete = excluded.complete,
      observed_days = excluded.observed_days,
      expected_days = excluded.expected_days,
      through_date = excluded.through_date,
      source_fetched_at = excluded.source_fetched_at,
      updated_at = now()
    where
      (not current.complete and excluded.observed_days >= current.observed_days)
      or
      (current.complete and excluded.complete and excluded.source_fetched_at > current.source_fetched_at)
    returning 1
  )
  select count(*) into changed from written;

  return changed;
end;
$$;

revoke all on function public.visitor_months_get(text,text,date[]),
  public.visitor_months_store(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.visitor_months_get(text,text,date[]),
  public.visitor_months_store(jsonb)
  to service_role;

-- Source: supabase/migrations/20260920110556_tourism_api_response_cache.sql
-- 모든 한국관광공사 API 페이지의 검증된 공개 응답을 Vercel 인스턴스 간 공유합니다.
create table public.tourism_api_cache (
  request_sha256 text primary key check (request_sha256 ~ '^[a-f0-9]{64}$'),
  operation text not null check (operation ~ '^[A-Za-z0-9]+/[A-Za-z0-9]+$'),
  request_params jsonb not null check (jsonb_typeof(request_params) = 'object' and pg_column_size(request_params) <= 4096),
  response_payload jsonb not null check (
    jsonb_typeof(response_payload) = 'object'
    and jsonb_typeof(response_payload->'items') = 'array'
    and jsonb_array_length(response_payload->'items') <= 1000
    and jsonb_typeof(response_payload->'totalCount') = 'number'
    and (response_payload->>'totalCount') ~ '^[0-9]+$'
    and (response_payload->>'totalCount')::numeric >= jsonb_array_length(response_payload->'items')
    and pg_column_size(response_payload) <= 2097152
  ),
  source_fetched_at timestamptz not null check (source_fetched_at <= now() + interval '5 minutes'),
  stored_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  schema_version smallint not null default 1 check (schema_version = 1)
);

create index tourism_api_cache_operation_fetched
  on public.tourism_api_cache(operation, source_fetched_at desc);

comment on table public.tourism_api_cache is
  'Server-only shared cache of validated Korea Tourism Organization API pages. Keys exclude credentials and include normalized operation parameters.';

alter table public.tourism_api_cache enable row level security;
revoke all on public.tourism_api_cache from public, anon, authenticated, service_role;

create function public.tourism_cache_get(
  p_request_sha256 text,
  p_operation text,
  p_request_params jsonb,
  p_schema_version smallint default 1
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cached public.tourism_api_cache%rowtype;
begin
  if p_request_sha256 is null or p_request_sha256 !~ '^[a-f0-9]{64}$'
    or p_operation is null or p_operation !~ '^[A-Za-z0-9]+/[A-Za-z0-9]+$'
    or p_request_params is null or jsonb_typeof(p_request_params) <> 'object' or pg_column_size(p_request_params) > 4096
    or p_schema_version <> 1 then
    raise exception 'INVALID_TOURISM_CACHE_QUERY';
  end if;

  select * into cached
  from public.tourism_api_cache
  where request_sha256 = p_request_sha256;
  if not found then return jsonb_build_object('state', 'missing'); end if;
  if cached.operation is distinct from p_operation
    or cached.request_params is distinct from p_request_params
    or cached.schema_version is distinct from p_schema_version then
    raise exception 'TOURISM_CACHE_KEY_CONFLICT';
  end if;
  return jsonb_build_object('state', 'stored', 'payload', cached.response_payload,
    'fetchedAt', cached.source_fetched_at);
end;
$$;

create function public.tourism_cache_store(
  p_request_sha256 text,
  p_operation text,
  p_request_params jsonb,
  p_response_payload jsonb,
  p_source_fetched_at timestamptz,
  p_schema_version smallint default 1
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cached public.tourism_api_cache%rowtype;
begin
  if p_request_sha256 is null or p_request_sha256 !~ '^[a-f0-9]{64}$'
    or p_operation is null or p_operation !~ '^[A-Za-z0-9]+/[A-Za-z0-9]+$'
    or p_request_params is null or jsonb_typeof(p_request_params) <> 'object' or pg_column_size(p_request_params) > 4096
    or p_response_payload is null or jsonb_typeof(p_response_payload) <> 'object'
    or p_source_fetched_at is null or p_schema_version <> 1 then
    raise exception 'INVALID_TOURISM_CACHE_WRITE';
  end if;

  select * into cached from public.tourism_api_cache
  where request_sha256 = p_request_sha256 for update;
  if found and (cached.operation is distinct from p_operation
    or cached.request_params is distinct from p_request_params
    or cached.schema_version is distinct from p_schema_version) then
    raise exception 'TOURISM_CACHE_KEY_CONFLICT';
  end if;

  if not found then
    perform pg_advisory_xact_lock(7019260920);
    if (select count(*) from public.tourism_api_cache) >= 2000 then
      delete from public.tourism_api_cache
      where request_sha256 = (
        select request_sha256 from public.tourism_api_cache
        order by updated_at, request_sha256 limit 1
      );
    end if;
  end if;

  insert into public.tourism_api_cache as current(
    request_sha256, operation, request_params, response_payload, source_fetched_at, schema_version
  ) values (
    p_request_sha256, p_operation, p_request_params, p_response_payload, p_source_fetched_at, p_schema_version
  )
  on conflict (request_sha256) do update set
    response_payload = excluded.response_payload,
    source_fetched_at = excluded.source_fetched_at,
    updated_at = now()
  where excluded.source_fetched_at >= current.source_fetched_at;

  return public.tourism_cache_get(p_request_sha256, p_operation, p_request_params, p_schema_version);
end;
$$;

revoke all on function public.tourism_cache_get(text,text,jsonb,smallint),
  public.tourism_cache_store(text,text,jsonb,jsonb,timestamptz,smallint)
  from public, anon, authenticated, service_role;
grant execute on function public.tourism_cache_get(text,text,jsonb,smallint),
  public.tourism_cache_store(text,text,jsonb,jsonb,timestamptz,smallint)
  to service_role;

-- Source: docs/supabase-evidence-extension.proposed.sql
-- DESIGN / LOCAL VALIDATION ONLY. Not yet wired to application endpoints.
-- Prerequisite: the existing monthly briefing migrations + organization_scenarios migration.
-- Historical reference evidence is not a budget/duration-dependent forecast.

create table public.policy_evidence_releases (
  id uuid primary key default gen_random_uuid(),
  dataset_key text not null default 'festival_visitors' check (dataset_key = 'festival_visitors'),
  artifact_schema_version integer not null check (artifact_schema_version = 1),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  provenance_revision integer not null default 1 check (provenance_revision > 0),
  repository_commit text not null check (repository_commit ~ '^[a-f0-9]{40}$'),
  generated_at timestamptz not null,
  imported_at timestamptz not null default now(),
  -- The source document is authoritative; statistics below are its query projection.
  artifact_payload jsonb not null check (jsonb_typeof(artifact_payload) = 'object'),
  provenance_status text not null default 'partial' check (provenance_status in ('partial', 'complete')),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  unique (artifact_sha256, provenance_revision),
  check (provenance_status <> 'complete' or coalesce((
    provenance ? 'producer_commit' and provenance->>'producer_commit' ~ '^[a-f0-9]{40}$'
    and jsonb_typeof(provenance->'raw_artifacts') = 'array'
    and jsonb_array_length(provenance->'raw_artifacts') > 0
  ), false))
);
create index idx_evidence_releases_generated on public.policy_evidence_releases(generated_at desc, id desc);

create table public.policy_evidence_statistics (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.policy_evidence_releases(id) on delete restrict,
  outcome text not null check (outcome in ('outside', 'total')),
  segment text not null check (segment in ('all', 'short', 'long', 'night', 'metroGu', 'placebo')),
  sample_count integer not null check (sample_count >= 0),
  estimate_kind text not null default 'historical_adjusted_change' check (estimate_kind = 'historical_adjusted_change'),
  mean_pct numeric,
  median_pct numeric,
  ci_lower_pct numeric,
  ci_upper_pct numeric,
  interval_level numeric not null default 0.95 check (interval_level = 0.95),
  share_positive numeric,
  unique (release_id, outcome, segment),
  check (
    sample_count = 0 and mean_pct is null and median_pct is null
      and ci_lower_pct is null and ci_upper_pct is null and share_positive is null
    or sample_count > 0 and mean_pct is not null and median_pct is not null
      and ci_lower_pct is not null and ci_upper_pct is not null and share_positive is not null
  ),
  check (mean_pct >= -100 and mean_pct < 'Infinity'::numeric),
  check (median_pct >= -100 and median_pct < 'Infinity'::numeric),
  check (ci_lower_pct >= -100 and ci_lower_pct <= ci_upper_pct and ci_upper_pct < 'Infinity'::numeric),
  check (share_positive >= 0 and share_positive <= 1)
);

create table public.scenario_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  scenario_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  evidence_statistic_id uuid references public.policy_evidence_statistics(id) on delete restrict,
  reference_status text not null check (reference_status in ('available', 'insufficient_evidence', 'unsupported_policy', 'out_of_scope', 'not_imported')),
  review_kind text not null default 'historical_reference' check (review_kind = 'historical_reference'),
  selection_rule_version text not null check (length(trim(selection_rule_version)) between 1 and 100),
  baseline_schema_version integer not null default 1 check (baseline_schema_version = 1),
  baseline_status text not null check (baseline_status in ('complete', 'partial', 'unavailable')),
  -- Freeze the actual SummaryResponse/DiagnosisResponse with their own months,
  -- units, fetchedAt and diagnosis model version. Missing responses remain NULL.
  baseline_snapshot jsonb not null check (jsonb_typeof(baseline_snapshot) = 'object'
    and baseline_snapshot ?& array['summary', 'diagnosis', 'capturedAt', 'request']
    and jsonb_typeof(baseline_snapshot->'capturedAt') = 'string'
    and jsonb_typeof(baseline_snapshot->'request') = 'object'
    and jsonb_typeof(baseline_snapshot->'summary') in ('object', 'null')
    and jsonb_typeof(baseline_snapshot->'diagnosis') in ('object', 'null')),
  idempotency_key uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (organization_id, scenario_id)
    references public.simulation_scenarios(organization_id, id) on delete restrict,
  unique (organization_id, idempotency_key),
  check ((reference_status in ('available', 'insufficient_evidence')) = (evidence_statistic_id is not null)),
  check (baseline_status <> 'complete' or (
    jsonb_typeof(baseline_snapshot->'summary') = 'object' and jsonb_typeof(baseline_snapshot->'diagnosis') = 'object'
  )),
  check (baseline_status <> 'partial' or (
    jsonb_typeof(baseline_snapshot->'summary') = 'object' or jsonb_typeof(baseline_snapshot->'diagnosis') = 'object'
  )),
  check (baseline_status <> 'unavailable' or (
    baseline_snapshot->'summary' = 'null'::jsonb and baseline_snapshot->'diagnosis' = 'null'::jsonb
  ))
);
create index idx_reviews_org_recent on public.scenario_reviews(organization_id, created_at desc, id desc);
create index idx_reviews_scenario on public.scenario_reviews(organization_id, scenario_id, created_at desc);
create index idx_reviews_statistic on public.scenario_reviews(evidence_statistic_id);
create index idx_reviews_creator on public.scenario_reviews(created_by);

alter table public.policy_evidence_releases enable row level security;
alter table public.policy_evidence_statistics enable row level security;
alter table public.scenario_reviews enable row level security;
revoke all on public.policy_evidence_releases, public.policy_evidence_statistics, public.scenario_reviews
  from public, anon, authenticated, service_role;
grant select on public.policy_evidence_releases, public.policy_evidence_statistics, public.scenario_reviews to service_role;
grant select on public.scenario_reviews to authenticated;
create policy reviews_read_member on public.scenario_reviews for select to authenticated using (
  organization_id in (select organization_id from public.organization_members where user_id = (select auth.uid()))
);

create function public.protect_evidence_history() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Retain history on Auth account deletion; only the author FK may be cleared.
  if tg_table_name = 'scenario_reviews' and tg_op = 'UPDATE' then
    if old.created_by is not null and new.created_by is null
      and (to_jsonb(old) - 'created_by') = (to_jsonb(new) - 'created_by') then
      return new;
    end if;
  end if;
  raise exception 'Evidence and saved reviews are immutable; create a new version.';
end;
$$;
create trigger evidence_releases_immutable before update or delete on public.policy_evidence_releases
  for each row execute function public.protect_evidence_history();
create trigger evidence_statistics_immutable before update or delete on public.policy_evidence_statistics
  for each row execute function public.protect_evidence_history();
create trigger scenario_reviews_immutable before update or delete on public.scenario_reviews
  for each row execute function public.protect_evidence_history();
revoke all on function public.protect_evidence_history() from public, anon, authenticated, service_role;

-- Operator-only import. The caller calculates SHA-256 over original file bytes.
-- No user endpoint may pass an arbitrary client-provided artifact to this RPC.
-- Original input provenance is partial unless the separate import verifier proves it.
create function public.import_policy_evidence(
  p_payload jsonb, p_artifact_sha256 text, p_repository_commit text,
  p_provenance jsonb default '{}'::jsonb, p_provenance_revision integer default 1,
  p_provenance_status text default 'partial'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_existing public.policy_evidence_releases;
  v_outcome text;
  v_segment text;
  v_stat jsonb;
  v_raw jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or (p_payload->>'version') is distinct from '1'
    or jsonb_typeof(p_payload->'data') is distinct from 'object'
    or jsonb_typeof(p_payload->'outside') is distinct from 'object'
    or jsonb_typeof(p_payload->'total') is distinct from 'object'
    or p_payload->>'generatedAt' is null then
    raise exception 'INVALID_EVIDENCE_DOCUMENT';
  end if;
  if p_provenance_status is null or p_provenance_status not in ('partial', 'complete')
    or p_provenance is null or jsonb_typeof(p_provenance) <> 'object' then raise exception 'INVALID_PROVENANCE'; end if;
  if p_provenance_status = 'complete' then
    if not coalesce((p_provenance->>'producer_commit' ~ '^[a-f0-9]{40}$'
      and jsonb_typeof(p_provenance->'parameters') = 'object'
      and jsonb_typeof(p_provenance->'runtime') = 'object'
      and jsonb_typeof(p_provenance->'raw_artifacts') = 'array'
      and jsonb_array_length(p_provenance->'raw_artifacts') > 0), false) then raise exception 'INVALID_PROVENANCE'; end if;
    for v_raw in select value from jsonb_array_elements(p_provenance->'raw_artifacts') loop
      if not coalesce((jsonb_typeof(v_raw) = 'object'
        and length(trim(v_raw->>'storage_path')) > 0 and v_raw->>'storage_path' !~ '[?#]'
        and v_raw->>'sha256' ~ '^[a-f0-9]{64}$'
        and length(trim(v_raw->>'source_name')) > 0
        and v_raw->>'fetched_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'), false)
      then raise exception 'INVALID_PROVENANCE'; end if;
      perform (v_raw->>'fetched_at')::timestamptz;
    end loop;
  end if;
  insert into public.policy_evidence_releases(artifact_schema_version, artifact_sha256, repository_commit,
    generated_at, artifact_payload, provenance, provenance_revision, provenance_status)
  values (1, p_artifact_sha256, p_repository_commit, (p_payload->>'generatedAt')::timestamptz, p_payload, p_provenance, p_provenance_revision, p_provenance_status)
  on conflict (artifact_sha256, provenance_revision) do nothing returning id into v_id;
  if v_id is null then
    select * into v_existing from public.policy_evidence_releases
      where artifact_sha256 = p_artifact_sha256 and provenance_revision = p_provenance_revision;
    if v_existing.artifact_payload is distinct from p_payload
      or v_existing.repository_commit is distinct from p_repository_commit
      or v_existing.provenance is distinct from p_provenance
      or v_existing.provenance_status is distinct from p_provenance_status
      then raise exception 'ARTIFACT_HASH_CONFLICT'; end if;
    return v_existing.id;
  end if;
  foreach v_outcome in array array['outside', 'total'] loop
    foreach v_segment in array array['all', 'short', 'long', 'night', 'metroGu', 'placebo'] loop
      v_stat := p_payload #> array[v_outcome, v_segment];
      if v_stat is null then raise exception 'MISSING_STATISTIC'; end if;
      if v_stat = 'null'::jsonb then
        insert into public.policy_evidence_statistics(release_id, outcome, segment, sample_count)
          values (v_id, v_outcome, v_segment, 0);
      else
        if jsonb_typeof(v_stat) <> 'object' or not (v_stat ?& array['n','meanPct','medianPct','ci95Pct','sharePositive'])
          or jsonb_typeof(v_stat->'ci95Pct') is distinct from 'array'
          or jsonb_array_length(v_stat->'ci95Pct') <> 2 then raise exception 'INVALID_STATISTIC'; end if;
        insert into public.policy_evidence_statistics(release_id, outcome, segment, sample_count,
          mean_pct, median_pct, ci_lower_pct, ci_upper_pct, share_positive)
        values (v_id, v_outcome, v_segment, (v_stat->>'n')::integer,
          (v_stat->>'meanPct')::numeric, (v_stat->>'medianPct')::numeric,
          (v_stat->'ci95Pct'->>0)::numeric, (v_stat->'ci95Pct'->>1)::numeric, (v_stat->>'sharePositive')::numeric);
      end if;
    end loop;
  end loop;
  return v_id;
end;
$$;
revoke all on function public.import_policy_evidence(jsonb,text,text,jsonb,integer,text) from public, anon, authenticated;
grant execute on function public.import_policy_evidence(jsonb,text,text,jsonb,integer,text) to service_role;

-- Server-only save: p_user_id must come from verified Auth, never the request body.
-- API must collect/validate baseline_snapshot itself; SQL checks only its envelope.
create function public.save_scenario_review(
  p_organization_id uuid, p_scenario_id uuid, p_user_id uuid, p_idempotency_key uuid,
  p_request_sha256 text, p_baseline_status text, p_baseline_snapshot jsonb,
  p_evidence_release_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_scenario public.simulation_scenarios;
  v_review public.scenario_reviews;
  v_stat public.policy_evidence_statistics;
  v_status text;
  v_segment text;
  v_response jsonb;
begin
  select role into v_role from public.organization_members
    where organization_id = p_organization_id and user_id = p_user_id for share;
  if v_role is null or v_role not in ('admin', 'editor') then
    raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('review:' || p_organization_id::text || ':' || p_idempotency_key::text, 0));
  select * into v_review from public.scenario_reviews
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    if v_review.request_sha256 <> p_request_sha256 or v_review.scenario_id <> p_scenario_id then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return to_jsonb(v_review);
  end if;
  select * into v_scenario from public.simulation_scenarios
    where organization_id = p_organization_id and id = p_scenario_id for share;
  if not found then raise exception using errcode = '42501', message = 'SCENARIO_NOT_ACCESSIBLE'; end if;
  if p_baseline_snapshot is null or jsonb_typeof(p_baseline_snapshot) <> 'object'
    or (p_baseline_snapshot->'request'->>'regionId') is distinct from v_scenario.region_id
    or (p_baseline_snapshot->'request'->>'districtId') is distinct from v_scenario.district_id
    or not coalesce(p_baseline_snapshot->>'capturedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$', false)
    then raise exception 'INVALID_BASELINE'; end if;
  perform (p_baseline_snapshot->>'capturedAt')::timestamptz;
  foreach v_segment in array array['summary','diagnosis'] loop
    v_response := p_baseline_snapshot->v_segment;
    if jsonb_typeof(v_response) = 'object' then
      if (v_response->>'district') is distinct from v_scenario.district_id
        or not coalesce(v_response->>'baseYm' ~ '^[0-9]{4}(0[1-9]|1[0-2])$', false)
        or not coalesce(v_response->>'fetchedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$', false)
        then raise exception 'INVALID_BASELINE'; end if;
      perform (v_response->>'fetchedAt')::timestamptz;
    end if;
  end loop;
  if v_scenario.policy_code not in ('festival', 'night') then
    v_status := 'unsupported_policy';
  elsif v_scenario.policy_code = 'festival' and not (
    v_scenario.district_id in ('12210','12240','12270','12300','12330')
    or left(v_scenario.district_id,2) = '11'
    or (left(v_scenario.district_id,2) in ('26','27','28','30','31') and substring(v_scenario.district_id from 3)::integer < 700)
  ) then
    v_status := 'out_of_scope';
  elsif p_evidence_release_id is null then
    v_status := 'not_imported';
  else
    v_segment := case when v_scenario.policy_code = 'festival' then 'metroGu' else 'night' end;
    select * into v_stat from public.policy_evidence_statistics
      where release_id = p_evidence_release_id and outcome = 'outside' and segment = v_segment;
    if not found then raise exception 'EVIDENCE_RELEASE_NOT_FOUND'; end if;
    v_status := case when v_stat.sample_count > 0 and v_stat.ci_lower_pct > 0 then 'available' else 'insufficient_evidence' end;
  end if;
  insert into public.scenario_reviews(organization_id, scenario_id, created_by, evidence_statistic_id,
    reference_status, selection_rule_version, baseline_status, baseline_snapshot, idempotency_key, request_sha256)
  values (p_organization_id, p_scenario_id, p_user_id, v_stat.id, v_status, 'festival-reference-v2',
    p_baseline_status, p_baseline_snapshot, p_idempotency_key, p_request_sha256) returning * into v_review;
  return to_jsonb(v_review);
end;
$$;
revoke all on function public.save_scenario_review(uuid,uuid,uuid,uuid,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.save_scenario_review(uuid,uuid,uuid,uuid,text,text,jsonb,uuid) to service_role;

-- Read-only deployment contract: FastAPI checks this before collecting/saving new reviews.
create or replace function public.review_contract() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('rule_version', 'festival-reference-v2', 'baseline_schema_version', 1);
$$;
revoke all on function public.review_contract() from public, anon, authenticated;
grant execute on function public.review_contract() to service_role;

comment on table public.policy_evidence_releases is 'Immutable imported artifact. repository_commit locates the checked-in artifact; it does not prove the original execution environment.';
comment on table public.policy_evidence_statistics is 'Derived only by import RPC from artifact_payload. meanPct is exp(mean(log_effect))-1, not the arithmetic mean of per-event percentages.';
comment on table public.scenario_reviews is 'Organization-owned frozen baseline and historical evidence selection. Not a future forecast or budget response.';
commit;
