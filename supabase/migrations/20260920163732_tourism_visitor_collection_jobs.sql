begin;

create table public.tourism_visitor_collection_jobs (
  base_month date primary key check (
    extract(day from base_month) = 1
    and base_month >= date '2019-01-01'
    and base_month < date_trunc('month', timezone('Asia/Seoul', now()))::date
  ),
  status text not null check (status in ('generating', 'completed', 'failed')),
  owner_token uuid not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  finished_at timestamptz,
  attempt_count integer not null default 1 check (attempt_count between 1 and 20),
  retry_after timestamptz,
  error_code text check (error_code in (
    'UPSTREAM_RATE_LIMIT', 'UPSTREAM_AUTH', 'UPSTREAM_UNAVAILABLE',
    'REQUEST_TIMEOUT', 'INVALID_DATA', 'STORE_FAILED'
  )),
  stored_rows integer check (stored_rows is null or stored_rows >= 0),
  check (
    (status = 'generating' and finished_at is null and retry_after is null and error_code is null and stored_rows is null)
    or
    (status = 'completed' and finished_at is not null and retry_after is null and error_code is null and stored_rows is not null)
    or
    (status = 'failed' and finished_at is not null and retry_after is not null and error_code is not null and stored_rows is null)
  )
);

create index tourism_visitor_collection_jobs_active
  on public.tourism_visitor_collection_jobs(deadline_at)
  where status = 'generating';

alter table public.tourism_visitor_collection_jobs enable row level security;
revoke all on public.tourism_visitor_collection_jobs from public, anon, authenticated, service_role;

create function public.visitor_collection_get(p_months date[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_months is null or cardinality(p_months) not between 1 and 24
    or exists (select 1 from unnest(p_months) value where value is null or extract(day from value) <> 1) then
    raise exception 'INVALID_VISITOR_COLLECTION_QUERY';
  end if;
  select jsonb_agg(jsonb_build_object(
    'month', to_char(requested.month, 'YYYYMM'),
    'state', case
      when job.base_month is null then 'missing'
      when job.status = 'generating' and job.deadline_at <= clock_timestamp() then 'retryable'
      else job.status
    end,
    'attemptCount', coalesce(job.attempt_count, 0),
    'retryAfter', case when job.status = 'failed' then job.retry_after else null end,
    'errorCode', job.error_code
  ) order by requested.month)
  into result
  from unnest(p_months) requested(month)
  left join public.tourism_visitor_collection_jobs job on job.base_month = requested.month;
  return coalesce(result, '[]'::jsonb);
end;
$$;

create function public.visitor_collection_claim(p_month date, p_owner_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_job public.tourism_visitor_collection_jobs%rowtype;
  current_month date := date_trunc('month', timezone('Asia/Seoul', clock_timestamp()))::date;
begin
  if p_month is null or extract(day from p_month) <> 1
    or p_month >= current_month or p_month < current_month - interval '36 months'
    or p_owner_token is null then
    raise exception 'INVALID_VISITOR_COLLECTION_MONTH';
  end if;
  perform pg_advisory_xact_lock(7019260921);
  select * into current_job from public.tourism_visitor_collection_jobs where base_month = p_month for update;
  if found then
    if current_job.status = 'completed' then
      return jsonb_build_object('state', 'completed', 'month', to_char(p_month, 'YYYYMM'));
    end if;
    if current_job.status = 'generating' and current_job.deadline_at > clock_timestamp() then
      return jsonb_build_object('state', 'generating', 'month', to_char(p_month, 'YYYYMM'));
    end if;
    if current_job.status = 'failed' and current_job.retry_after > clock_timestamp() then
      return jsonb_build_object('state', 'failed', 'month', to_char(p_month, 'YYYYMM'),
        'retryAfter', current_job.retry_after, 'errorCode', current_job.error_code);
    end if;
    if current_job.attempt_count >= 20 then
      return jsonb_build_object('state', 'failed', 'month', to_char(p_month, 'YYYYMM'),
        'retryAfter', clock_timestamp() + interval '1 day', 'errorCode', coalesce(current_job.error_code, 'STORE_FAILED'));
    end if;
  end if;
  if exists (select 1 from public.tourism_visitor_collection_jobs
    where status = 'generating' and deadline_at > clock_timestamp() and base_month <> p_month) then
    return jsonb_build_object('state', 'busy', 'month', to_char(p_month, 'YYYYMM'));
  end if;
  insert into public.tourism_visitor_collection_jobs(
    base_month, status, owner_token, started_at, deadline_at, finished_at,
    attempt_count, retry_after, error_code, stored_rows
  ) values (
    p_month, 'generating', p_owner_token, clock_timestamp(), clock_timestamp() + interval '280 seconds', null,
    1, null, null, null
  ) on conflict (base_month) do update set
    status = 'generating', owner_token = excluded.owner_token,
    started_at = excluded.started_at, deadline_at = excluded.deadline_at, finished_at = null,
    attempt_count = public.tourism_visitor_collection_jobs.attempt_count + 1,
    retry_after = null, error_code = null, stored_rows = null;
  return jsonb_build_object('state', 'claimed', 'month', to_char(p_month, 'YYYYMM'));
end;
$$;

create function public.visitor_collection_finish(p_month date, p_owner_token uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  job public.tourism_visitor_collection_jobs%rowtype;
  changed integer;
begin
  select * into job from public.tourism_visitor_collection_jobs
  where base_month = p_month for update;
  if not found or job.status <> 'generating' or job.owner_token is distinct from p_owner_token
    or job.deadline_at <= clock_timestamp() then
    raise exception 'VISITOR_COLLECTION_NOT_OWNED';
  end if;
  changed := public.visitor_months_store(p_rows);
  update public.tourism_visitor_collection_jobs set
    status = 'completed', finished_at = clock_timestamp(), stored_rows = changed
  where base_month = p_month;
  return jsonb_build_object('state', 'completed', 'month', to_char(p_month, 'YYYYMM'), 'storedRows', changed);
end;
$$;

create function public.visitor_collection_fail(
  p_month date, p_owner_token uuid, p_error_code text, p_retry_seconds integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare retry_at timestamptz;
begin
  if p_error_code not in ('UPSTREAM_RATE_LIMIT', 'UPSTREAM_AUTH', 'UPSTREAM_UNAVAILABLE',
      'REQUEST_TIMEOUT', 'INVALID_DATA', 'STORE_FAILED')
    or p_retry_seconds not between 30 and 86400 then
    raise exception 'INVALID_VISITOR_COLLECTION_FAILURE';
  end if;
  retry_at := clock_timestamp() + make_interval(secs => p_retry_seconds);
  update public.tourism_visitor_collection_jobs set
    status = 'failed', finished_at = clock_timestamp(), retry_after = retry_at,
    error_code = p_error_code, stored_rows = null
  where base_month = p_month and status = 'generating' and owner_token = p_owner_token;
  if not found then raise exception 'VISITOR_COLLECTION_NOT_OWNED'; end if;
  return jsonb_build_object('state', 'failed', 'month', to_char(p_month, 'YYYYMM'),
    'retryAfter', retry_at, 'errorCode', p_error_code);
end;
$$;

revoke all on function public.visitor_collection_get(date[]),
  public.visitor_collection_claim(date,uuid),
  public.visitor_collection_finish(date,uuid,jsonb),
  public.visitor_collection_fail(date,uuid,text,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.visitor_collection_get(date[]),
  public.visitor_collection_claim(date,uuid),
  public.visitor_collection_finish(date,uuid,jsonb),
  public.visitor_collection_fail(date,uuid,text,integer)
  to service_role;

commit;
