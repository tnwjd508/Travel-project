begin;

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

commit;
