-- Shared tenancy for monthly briefing + policy scenarios. No forecast seeds.
begin;

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
commit;
