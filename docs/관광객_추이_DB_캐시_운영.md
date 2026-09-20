# 관광객 추이 Supabase 영속 캐시

관광객 추이는 한국관광공사 DataLabService의 전국 일별 추정 방문자 자료를 월별·지자체별로 집계한다. Vercel 메모리 캐시는 인스턴스가 바뀌면 사라지므로 `tourism_visitor_months`에 성공한 집계를 보관한다.

## 적용 순서

현재 8개 서비스 테이블이 있는 Supabase 프로젝트의 SQL Editor에서 다음 후속 마이그레이션만 한 번 실행한다.

`supabase/migrations/20260920104513_tourism_visitor_month_cache.sql`

빈 DB용 `docs/supabase-current-design.proposed.sql`을 기존 DB에 다시 실행하지 않는다. 마이그레이션은 테이블 한 개와 `visitor_months_get`, `visitor_months_store` 함수만 추가하며 기존 데이터를 수정하지 않는다.

적용 후 확인:

```sql
select to_regclass('public.tourism_visitor_months');

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('visitor_months_get', 'visitor_months_store')
order by routine_name;
```

## 런타임 동작

1. FastAPI는 요청한 현재 12개월과 전년 동월 12개월을 Supabase에서 한 번에 조회한다.
2. 저장된 월은 외부 API를 호출하지 않는다.
3. 누락 월이 있으면 공개 요청 한 번당 최신 누락 월 하나만 수집한다.
4. 한 달 전국 응답을 성공적으로 받으면 모든 지자체의 월별 집계를 한 RPC로 저장한다.
5. 외부 API가 실패하면 저장된 월은 계속 반환하고 나머지는 결측으로 표시한다.
6. 부분 수집 월은 `complete=false`, 합계는 NULL로 유지하여 완전한 월간 방문자 수처럼 표시하지 않는다.

테이블과 RPC는 서버 secret/service role만 사용한다. 브라우저의 `anon`·`authenticated` 역할에는 테이블 및 함수 권한이 없다.

## 과거 월 백필

기존 Vercel 메모리 캐시는 복구할 수 없다. 호출 한도가 정상화된 뒤 운영자가 월 단위로 다시 수집한다. 명령은 기본적으로 dry-run이다.

```powershell
# 호출 없이 대상 월만 확인
& .venv/Scripts/python.exe -m backend.backfill_visitors --from-month 2025-08 --to-month 2026-07

# API와 Supabase 설정을 확인한 뒤 실제 수집·저장
& .venv/Scripts/python.exe -m backend.backfill_visitors --from-month 2025-08 --to-month 2026-07 --delay-seconds 2 --apply
```

백필은 저장된 서울 종로구 행으로 해당 전국 월의 완료 여부를 확인하고, 완전하게 저장된 월은 건너뛴다. 부분 수집 월은 다시 조회해 관측 일수가 늘어나면 갱신한다. 중간에 호출 제한이 발생하면 중단되며, 제한이 풀린 뒤 같은 명령을 다시 실행하면 완료 월을 건너뛰며 재개한다.

## 저장 상태 확인

```sql
select base_month, count(*) as districts,
       count(*) filter (where complete) as complete_districts,
       max(source_fetched_at) as fetched_at
from public.tourism_visitor_months
group by base_month
order by base_month desc;
```

기존 `monthly_briefings`의 방문자 근거는 일부 지역·한 달의 부분 집계만 포함하며 원래 일별 응답을 보존하지 않는다. 이를 완전한 추이 자료로 변환하거나 누락 일자를 추정하지 않는다.
