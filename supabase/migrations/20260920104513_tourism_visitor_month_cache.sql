begin;

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

commit;
