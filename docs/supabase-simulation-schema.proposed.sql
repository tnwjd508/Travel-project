-- DESIGN ONLY. Not an applied migration or a complete simulation implementation.
-- FUTURE FORECAST ENGINE ONLY: superseded for current features by
-- supabase-current-design.proposed.sql and supabase-database-design.md (2026-09-20).
-- Target: Supabase PostgreSQL, AFTER all supabase/migrations/*.sql.
-- Reuses organizations, organization_members, simulation_scenarios, monthly_briefings.
-- Apply through a reviewed migration after implementing the transaction rules
-- in supabase-simulation-design.md. No model or forecast values are seeded here.
begin;

-- A version is immutable once referenced. Retirement only blocks new runs.
-- The manifest records artifacts, code revision, feature definitions,
-- supported policies/metrics, training data version and validation evidence.
-- "validated" means approved for the declared capability scope; it does not
-- automatically authorize predictive or causal claims. See manifest.validation
-- requirements in the design document; the backend enforces that contract.
create table public.simulation_model_versions (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  version text not null,
  validation_status text not null default 'draft'
    check (validation_status in ('draft', 'validated', 'retired')),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (model_name, version)
);

create table public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  -- Backend-generated from frozen district/policy/budget/duration at creation.
  title text not null check (length(trim(title)) between 1 and 160),
  -- Canonical IDs and names are frozen from the existing TS catalogue.
  -- district_id is text, never an integer or the UI alias "donggu".
  region_id text not null,
  district_id text not null check (district_id ~ '^[0-9]{5}$'),
  district_name text not null,
  catalogue_version text not null,
  policy_code text not null check (policy_code in ('night', 'festival', 'shuttle', 'market', 'art')),
  policy_name text not null,
  budget_krw bigint not null check (budget_krw > 0),
  start_month date not null check (extract(day from start_month) = 1),
  duration_months smallint not null check (duration_months in (3, 6, 12)),
  scenario_parameters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(scenario_parameters) = 'object'),
  model_version_id uuid not null references public.simulation_model_versions(id) on delete restrict,
  execution_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(execution_config) = 'object'),
  request_schema_version integer not null default 1 check (request_schema_version > 0),
  idempotency_key uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  parent_run_id uuid,
  source_scenario_id uuid,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'insufficient_data', 'failed', 'cancelled')),
  attempt_no integer not null default 0 check (attempt_no >= 0),
  worker_token uuid,
  lease_expires_at timestamptz,
  error_code text,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancel_reason text check (length(trim(cancel_reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (organization_id, id),
  unique (id, region_id, district_id),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, parent_run_id)
    references public.simulation_runs(organization_id, id) on delete restrict,
  foreign key (organization_id, source_scenario_id)
    references public.simulation_scenarios(organization_id, id) on delete restrict,
  check (parent_run_id is null or parent_run_id <> id),
  check ((status = 'running') = (worker_token is not null and lease_expires_at is not null)),
  check (status = 'running' or (worker_token is null and lease_expires_at is null)),
  check ((status in ('succeeded', 'insufficient_data', 'failed', 'cancelled')) = (finished_at is not null)),
  check (status not in ('running', 'succeeded', 'insufficient_data') or started_at is not null),
  check (finished_at is null or finished_at >= created_at),
  check (started_at is null or started_at >= created_at),
  check (finished_at is null or started_at is null or finished_at >= started_at),
  check ((status = 'failed') = (error_code is not null)),
  check (
    status = 'cancelled' and cancelled_at is not null and cancel_reason is not null
      and cancelled_at = finished_at
    or status <> 'cancelled' and cancelled_by is null and cancelled_at is null and cancel_reason is null
  )
);
create index idx_simulation_runs_org_recent
  on public.simulation_runs(organization_id, created_at desc, id desc);
create index idx_simulation_runs_org_district
  on public.simulation_runs(organization_id, district_id, created_at desc, id desc);
create index idx_simulation_runs_model on public.simulation_runs(model_version_id);
create index idx_simulation_runs_creator on public.simulation_runs(created_by);
create index idx_simulation_runs_canceller on public.simulation_runs(cancelled_by);
create index idx_simulation_runs_scenario on public.simulation_runs(organization_id, source_scenario_id);
create index idx_simulation_runs_parent on public.simulation_runs(organization_id, parent_run_id);
create index idx_simulation_runs_pending on public.simulation_runs(created_at, id)
  where status = 'queued';
create index idx_simulation_runs_expired on public.simulation_runs(lease_expires_at)
  where status = 'running';

-- Permanent attempt history, separate from the run's disposable active lease.
-- Server-only: worker identity/tokens and internal error codes are not UI data.
create table public.simulation_run_attempts (
  run_id uuid not null references public.simulation_runs(id) on delete cascade,
  attempt_no integer not null check (attempt_no > 0),
  worker_id text not null check (length(trim(worker_id)) between 1 and 160),
  worker_token uuid not null unique,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'insufficient_data', 'failed', 'lease_expired', 'cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_code text,
  primary key (run_id, attempt_no),
  check ((status <> 'running') = (finished_at is not null)),
  check (finished_at is null or finished_at >= started_at),
  check ((status in ('failed', 'lease_expired')) = (error_code is not null))
);
create unique index idx_simulation_run_attempts_active
  on public.simulation_run_attempts(run_id) where status = 'running';

-- Only the actual sanitized inputs used by the engine, not an expiring cache.
-- Include parameter/feature values, source units, actual provider codes and
-- missing-value indicators in payload. Never include API keys or tokenized URLs.
create table public.simulation_input_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  region_id text not null,
  district_id text not null,
  briefing_month date check (extract(day from briefing_month) = 1),
  source_key text not null,
  source_name text not null,
  temporal_basis text not null check (temporal_basis in ('period', 'as_of', 'event_dates')),
  period_start date,
  period_end date,
  as_of_date date,
  fetched_at timestamptz not null,
  completeness text not null check (completeness in ('complete', 'partial', 'unavailable')),
  schema_version integer not null default 1 check (schema_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  unique (run_id, source_key),
  foreign key (run_id, region_id, district_id)
    references public.simulation_runs(id, region_id, district_id) on delete cascade,
  foreign key (region_id, district_id, briefing_month)
    references public.monthly_briefings(region_id, district_id, analysis_month) on delete restrict,
  check ((period_start is null) = (period_end is null)),
  check (period_end is null or period_end >= period_start),
  check (temporal_basis <> 'period' or period_start is not null),
  check (temporal_basis <> 'as_of' or as_of_date is not null)
);

create index idx_simulation_inputs_briefing on public.simulation_input_snapshots(region_id, district_id, briefing_month) where briefing_month is not null;

create table public.simulation_results (
  run_id uuid primary key references public.simulation_runs(id) on delete cascade,
  result_schema_version integer not null default 1 check (result_schema_version > 0),
  summary text not null,
  recommendations jsonb not null default '[]'::jsonb check (jsonb_typeof(recommendations) = 'array'),
  timeline jsonb not null default '[]'::jsonb check (jsonb_typeof(timeline) = 'array'),
  limitations jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  narrative_provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(narrative_provenance) = 'object'),
  created_at timestamptz not null default now()
);

-- Numeric results remain queryable; narrative JSON cannot redefine them.
-- horizon_month=0 means the entire run period, 1..duration_months means month N.
-- Engine contracts define metric_key, unit and aggregation precisely.
create table public.simulation_result_metrics (
  run_id uuid not null references public.simulation_results(run_id) on delete cascade,
  metric_key text not null,
  horizon_month smallint not null check (horizon_month >= 0),
  unit text not null check (unit in ('index', 'estimated_daily_visits_sum', 'krw', 'hours', 'percent')),
  aggregation text not null check (aggregation in ('sum', 'mean', 'end_of_period')),
  observed_value numeric,
  without_policy_value numeric,
  with_policy_value numeric,
  effect_type text check (effect_type in ('scenario_difference', 'causal_estimate')),
  delta_value numeric generated always as (with_policy_value - without_policy_value) stored,
  delta_pct numeric generated always as (
    case when without_policy_value <> 0
      then (with_policy_value - without_policy_value) / abs(without_policy_value) * 100
      else null end
  ) stored,
  effect_lower numeric,
  effect_upper numeric,
  interval_level numeric check (interval_level > 0 and interval_level < 1),
  unavailable_reason text,
  source_keys text[] not null default '{}',
  primary key (run_id, metric_key, horizon_month),
  check ((without_policy_value is null) = (with_policy_value is null)),
  check ((with_policy_value is null) = (unavailable_reason is not null)),
  check ((with_policy_value is null) = (effect_type is null)),
  check (effect_lower is null and effect_upper is null and interval_level is null
    or with_policy_value is not null and effect_lower is not null
       and effect_upper is not null and interval_level is not null and effect_lower <= effect_upper),
  check (observed_value is null or observed_value > '-Infinity'::numeric and observed_value < 'Infinity'::numeric),
  check (without_policy_value is null or without_policy_value > '-Infinity'::numeric and without_policy_value < 'Infinity'::numeric),
  check (with_policy_value is null or with_policy_value > '-Infinity'::numeric and with_policy_value < 'Infinity'::numeric),
  check (effect_lower is null or effect_lower > '-Infinity'::numeric and effect_lower < 'Infinity'::numeric),
  check (effect_upper is null or effect_upper > '-Infinity'::numeric and effect_upper < 'Infinity'::numeric)
);

alter table public.simulation_model_versions enable row level security;
alter table public.simulation_runs enable row level security;
alter table public.simulation_run_attempts enable row level security;
alter table public.simulation_input_snapshots enable row level security;
alter table public.simulation_results enable row level security;
alter table public.simulation_result_metrics enable row level security;

revoke all on public.simulation_model_versions, public.simulation_runs,
  public.simulation_run_attempts,
  public.simulation_input_snapshots, public.simulation_results,
  public.simulation_result_metrics from public, anon, authenticated;

grant select on public.simulation_results, public.simulation_result_metrics to authenticated;
-- Do not expose current lease tokens, internal config or idempotency fingerprints.
grant select (id, organization_id, created_by, title, region_id, district_id,
  district_name, catalogue_version, policy_code, policy_name, budget_krw,
  start_month, duration_months, scenario_parameters, model_version_id,
  parent_run_id, source_scenario_id, status, error_code, cancelled_by,
  cancelled_at, cancel_reason, created_at, started_at, finished_at)
  on public.simulation_runs to authenticated;
-- Model manifests, attempt history and full input snapshots remain server-only.
grant select, insert, update, delete on public.simulation_model_versions,
  public.simulation_runs, public.simulation_input_snapshots,
  public.simulation_run_attempts,
  public.simulation_results, public.simulation_result_metrics to service_role;

create policy runs_read_member on public.simulation_runs
  for select to authenticated using (
    organization_id in (select organization_id from public.organization_members where user_id = (select auth.uid()))
  );

create policy results_read_member on public.simulation_results
  for select to authenticated using (
    exists (select 1 from public.simulation_runs r where r.id = simulation_results.run_id
      and r.organization_id in (select organization_id from public.organization_members where user_id = (select auth.uid())))
  );

create policy metrics_read_member on public.simulation_result_metrics
  for select to authenticated using (
    exists (select 1 from public.simulation_runs r where r.id = simulation_result_metrics.run_id
      and r.organization_id in (select organization_id from public.organization_members where user_id = (select auth.uid())))
  );

comment on table public.simulation_runs is
  'Organization-owned immutable execution conditions; lifecycle updated only through backend transactions.';
comment on table public.simulation_run_attempts is
  'Server-only attempt audit: retain completed worker identity even after the active lease is cleared.';
comment on table public.simulation_input_snapshots is
  'Immutable, sanitized engine input evidence. RLS enabled; server-only access.';
comment on table public.simulation_result_metrics is
  'Compare matching metrics, units, aggregation, horizons and forecast periods; missing values are NULL, not zero.';

commit;

-- No destructive down script is executed or supplied as an automatic rollback.
-- Before first production writes, rollback can remove only these new objects in
-- reverse dependency order. After writes, use a forward migration plus backup.
