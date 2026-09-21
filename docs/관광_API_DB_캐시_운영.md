# 한국관광공사 API Supabase 영속 캐시

Vercel 인스턴스의 메모리 캐시는 재시작과 확장 시 공유되지 않는다. FastAPI와 Node 월간 브리핑이 성공적으로 받은 한국관광공사 API 페이지를 `tourism_api_cache`에 저장하고, 방문자 자료는 차트 조회를 위해 `tourism_visitor_months`에도 월별·지자체별로 집계한다.

VWorld 경계 API와 Gemini 응답은 이 캐시에 포함하지 않는다. 월간 AI 브리핑 완성본은 기존 `monthly_briefings`에 저장한다.

## 기존 DB 적용 순서

현재 8개 서비스 테이블이 있는 Supabase SQL Editor에서 아래 파일을 순서대로 각각 한 번 실행한다.

1. `supabase/migrations/20260920104513_tourism_visitor_month_cache.sql`
2. `supabase/migrations/20260920110556_tourism_api_response_cache.sql`
3. `supabase/migrations/20260920163732_tourism_visitor_collection_jobs.sql`

빈 DB용 `docs/supabase-current-design.proposed.sql`을 기존 DB에 다시 실행하지 않는다. 후속 마이그레이션은 기존 행을 수정하거나 삭제하지 않는다.

적용 확인:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('tourism_visitor_months', 'tourism_api_cache', 'tourism_visitor_collection_jobs')
order by tablename;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'visitor_months_get', 'visitor_months_store',
    'tourism_cache_get', 'tourism_cache_store',
    'visitor_collection_get', 'visitor_collection_claim',
    'visitor_collection_finish', 'visitor_collection_fail'
  )
order by routine_name;
```

## 저장 범위

- `/api/district/summary`, `visitors`, `indices`, `contents`, `festivals`, `related`, `rank`, `diagnosis`, `hubs`가 사용하는 관광공사 페이지
- `/api/tourism`에서 허용된 KorService2 페이지
- Node/LangGraph 월간 브리핑이 수집하는 방문자·지수·축제·중심 관광지 페이지

인증키는 요청 해시·파라미터·응답에 저장하지 않는다. Python과 Node는 `operation + 정렬된 공개 파라미터 + schema version`으로 같은 SHA-256 키를 만든다.

캐시가 유효하면 외부 API를 호출하지 않는다. 캐시가 오래됐으면 갱신을 시도하며, 상류 호출이 실패하면 오래된 검증 응답을 짧은 캐시 시간으로 반환한다. 성공 응답만 저장하고 오류 응답·키·URL은 저장하지 않는다.

관광객 추이는 DB에서 24개월을 먼저 읽고 누락 월이 있으면 프런트가 수집 POST를 자동 실행한다. 서버는 전국 한 달을 한 번만 선점해 원본 페이지와 지역별 집계를 저장하며 다른 요청은 기존 작업을 기다린다. 상세 절차는 [관광객 추이 캐시 운영](관광객_추이_DB_캐시_운영.md)을 참고한다.

## 상태 확인

```sql
select operation, count(*) as pages, max(source_fetched_at) as latest_source
from public.tourism_api_cache
group by operation
order by operation;

select base_month, count(*) as districts,
       count(*) filter (where complete) as complete_districts
from public.tourism_visitor_months
group by base_month
order by base_month desc;
```

과거 Vercel 메모리 캐시에만 존재했던 응답은 복구할 수 없다. 배포 후 새로 성공하는 호출부터 자동 저장되며, 방문자 과거 월은 백필해야 한다.
