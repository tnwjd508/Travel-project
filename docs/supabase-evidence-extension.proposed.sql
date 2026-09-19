-- DESIGN / LOCAL VALIDATION ONLY. Not yet wired to application endpoints.
-- Prerequisite: the existing monthly briefing migrations + organization_scenarios migration.
-- Historical reference evidence is not a budget/duration-dependent forecast.
begin;

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
