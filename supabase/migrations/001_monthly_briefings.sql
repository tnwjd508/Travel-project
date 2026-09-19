begin;

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

commit;
