begin;

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

commit;
