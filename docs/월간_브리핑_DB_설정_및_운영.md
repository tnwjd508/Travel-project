# 월간 브리핑 DB 설정 및 운영

기관 시나리오와 같은 프로젝트를 사용하는 현재 구성은 [Supabase 통합 설계·운영](supabase-integrated-design.md)을 먼저 참고한다. 아래는 월간 브리핑 부분의 운영 설명이다. 통합 구성에는 공개 인증키와 기관 시나리오 마이그레이션이 추가되며, 브리핑 테이블·함수는 중복 생성하지 않는다.

## 현재 구현 범위

코드는 Supabase PostgreSQL 저장소를 사용하도록 구현되어 있다. 실제 Supabase 연결 정보는 사용자가 나중에 설정하기로 했으므로 운영 DB의 테이블 생성과 연결 확인은 아직 하지 않았다. 연결 전 화면에는 `월간 브리핑 저장소 연결이 아직 설정되지 않았습니다.`가 나타나며 관광 API·Gemini로 우회하지 않는다.

이 기능은 사용자가 지역·월을 조회할 때만 동작하며 정기 점검이나 매월 예약 작업은 없다. main 통합 이후에는 React → FastAPI → Node 워커 → Supabase/Gemini 경로를 사용한다. FastAPI 서버와 Node 실행 환경이 필요하며 `npm run dev`가 로컬 서버들을 함께 실행한다. 워커는 FastAPI의 요청을 처리하며 주기적으로 데이터를 재생성하지 않는다.

## 1. 기존 Supabase 프로젝트에 테이블 만들기

Supabase 대시보드에서 사용할 프로젝트를 연 뒤 SQL Editor에서 아래 파일의 전체 내용을 순서대로 실행한다. 두 파일 모두 해당 기능 전용 새 테이블·함수를 생성하며 기존 프로젝트의 다른 테이블은 수정하지 않는다.

1. `supabase/migrations/001_monthly_briefings.sql`
2. `supabase/migrations/002_monthly_briefing_jobs.sql`

이미 적용한 파일을 반복 실행하지 않는다. 새로 변경할 SQL은 기존 파일을 덮어 적용하지 않고 다음 순서 번호의 마이그레이션으로 작성한다. 동일 이름의 테이블이 이미 있는 프로젝트라면 먼저 기존 구조를 확인한다.

`monthly_briefings`에는 확정 브리핑, `monthly_briefing_jobs`에는 생성 중·완료·실패 상태가 저장된다. 확정 브리핑은 UPDATE와 DELETE가 차단된다. 부분 분석도 저장 이후에는 고정된다.

## 2. 로컬 연결 정보 설정

프로젝트 루트 `.env.local`에 다음 두 설정을 추가한다. 아래 값은 설명용 예시이며 실제 프로젝트 값으로 바꾼다. 기존 관광 API·Gemini 설정은 유지한다.

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-server-secret-key
```

Project URL은 프로젝트의 연결 안내에서 확인하고, 서버 전용 secret 키는 프로젝트 API Keys에서 확인한다. `sb_publishable_` 또는 기존 `anon` 키는 쓰기 권한이 없어 사용할 수 없다. 기존 `service_role` JWT를 사용하는 경우에는 위 `SUPABASE_SECRET_KEY` 대신 아래 이름을 사용한다. 두 키를 함께 설정하면 `SUPABASE_SECRET_KEY`가 우선한다.

```dotenv
SUPABASE_SERVICE_ROLE_KEY=your-service-role-jwt
```

키를 채팅·Git·SQL 파일에 넣지 않는다. `VITE_` 접두사도 붙이지 않는다. 브라우저가 아니라 백엔드만 키를 사용한다.

설정 후 개발 서버를 재시작하고 다음 명령으로 연결을 확인한다.

```powershell
npm run check:briefing:db
```

이 명령은 DB 조회 함수만 호출한다. `missing`은 연결은 성공했지만 아직 해당 월 결과가 없다는 정상 상태다. Gemini 분석이나 새 브리핑 생성을 실행하지 않는다.

## 3. Vercel 설정

Vercel에는 `FASTAPI_BASE_URL`과 `FASTAPI_PROXY_TOKEN`을 설정한다. 다음 값은 실제 FastAPI 서버의 환경변수에 설정한다. FastAPI에도 같은 `FASTAPI_PROXY_TOKEN`이 필요하다. 로컬은 프로젝트 루트 `.env.local`을 읽는다.

| 이름 | 용도 |
| --- | --- |
| `SUPABASE_URL` | 위 Supabase 프로젝트 주소 |
| `SUPABASE_SECRET_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY` | DB 서버 전용 키 |
| `TOUR_API_SERVICE_KEY` | 최초 관광 자료 수집 |
| `GEMINI_API_KEY` | 최초 AI 분석 |
| `GEMINI_MODEL` | 사용할 모델, 기본값 `gemini-3.8-flash` |

Vercel Production/Preview는 각각 적절한 FastAPI 주소를 지정한다. Preview에서 만든 결과가 운영 월을 먼저 확정하지 않도록 검증용 DB를 따로 쓰는 것이 좋다. 로컬 `.env.local`은 자동 배포되지 않는다.

`vercel.json`의 `api/monthly-briefing.ts` 실행 제한은 300초다. 그래프는 240초, DB 작업 권한은 280초로 제한하고 저장 여유를 둔다. FastAPI는 워커 응답을 285초, Vercel 전달 함수는 FastAPI 응답을 290초까지 기다린다. 배포 프로젝트에서 300초 실행이 지원·적용되는지 확인한다. 생성 요청은 저장까지 기다리며, 응답 후 작업을 방치하지 않는다.

## 4. 실제 동작

1. 화면을 열면 GET으로 DB의 해당 지역·월을 조회한다.
2. 저장 결과가 있으면 바로 표시하고 외부 수집·AI 호출은 하지 않는다.
3. 처음 조회한 미생성 지역·월이면 화면이 POST를 한 번 보낸다.
4. DB 등록 함수가 생성 권한을 한 요청에만 준다. 다른 요청은 생성 상태만 확인한다.
5. LangGraph가 API 자료를 수집하고 Gemini가 병합한다.
6. 유효한 진단이 있으면 정상·부분 결과 모두 확정 저장한다. 그 월에는 다시 생성하지 않는다.
7. 다른 사용자는 생성 중에만 5초 간격으로 GET 조회를 한다. 완료·실패·화면 이동·대기 시간 초과 시 멈춘다.

월이 바뀌면 새로운 진단 월의 기록을 추가한다. 이전 월의 내용·생성일·축제 기준일은 바꾸지 않는다. 광주의 영문 별칭과 숫자 코드는 동일한 DB 키로 처리한다.

## 5. 실패했을 때

| 상태 | 처리 |
| --- | --- |
| DB 미설정·연결 실패 | 오류 안내, AI 실행 없음 |
| 생성 중 | 같은 지역·월의 두 번째 생성은 실행하지 않음 |
| AI 일부 성공 | 부분 결과를 확정 저장, 같은 월 재생성 없음 |
| AI 전체 실패 | 확보한 자료와 실패 작업만 보관, 일반 조회로 재생성하지 않음 |
| 서버 중단·작업 만료 | `interrupted` 상태로 조회, 자동 재선점 없음 |
| DB 저장 응답 유실 | 같은 소유 토큰으로 저장만 한 번 재시도, AI 재실행 없음 |
| 다른 지역 생성 요청이 몰림 | 전체 동시 2개, 분당 신규 작업 6개로 제한 |

`저장 상태 다시 조회`는 GET만 실행한다. DB 작업 실패를 해제하거나 기존 결과를 덮어쓰는 기능은 없다. 저장 결과가 없는 실패·중단 작업의 운영자 복구는 해당 작업이 정말 끝났는지 확인하는 별도 절차가 필요하다.

## 6. 코드별 역할

| 파일 | 설명 |
| --- | --- |
| `server/briefing/repository.ts` | Supabase REST 함수 호출, 저장·조회 JSON 검증, 키 및 오류 원문 보호 |
| `server/briefing/service.ts` | 지역·월 정규화, DB 우선 조회, 최초 생성·저장·실패 처리 |
| `api/monthly-briefing.ts` | Vercel GET/POST 진입점과 상태 코드 |
| `vite.config.ts` | 로컬에서 동일 API와 서버 전용 환경변수 연결 |
| `src/lib/monthlyBriefingClient.ts` | 최초 POST 1회 및 생성 중 GET 폴링·취소 |
| `src/components/dashboard/MonthlyBriefing.tsx` | 저장·생성·실패 상태 및 저장 당시 축제 표시 |
| `scripts/check_briefing_db.ts` | 키를 출력하지 않는 DB 연결 점검 |

DB 함수가 생성 권한을 원자적으로 등록하고 결과 저장과 완료 전환을 한 트랜잭션에서 처리한다. 완료 후 응답이 유실돼도 같은 소유자의 재저장은 기존 결과를 반환한다. 외부 Gemini 호출과 DB 저장을 하나의 트랜잭션으로 묶을 수 없으므로 서버가 비정상 종료된 상황의 정확히 한 번 실행까지 보장하지는 않으며, 불확실한 상태의 자동 재생성을 차단한다.

## 검증 범위

운영 SQL을 PGlite의 PostgreSQL 엔진에 적용해 월별 저장, 별칭 통합, 독립 서비스의 동시 요청, 재조회, 실패·만료·응답 유실, DB 권한과 변경 금지를 검증한다. PGlite는 개발 테스트 전용이며 운영 저장소 대체 수단이 아니다. 실제 Supabase의 API 게이트웨이, 프로젝트 설정과 Vercel 배포 후 연결은 환경변수 설정 후 별도로 점검해야 한다.

```powershell
npm test
npm run test:briefing
npm run build
```

공식 문서: [Supabase DB 함수](https://supabase.com/docs/guides/database/functions), [서버 전용 키](https://supabase.com/docs/guides/getting-started/api-keys), [Vercel 환경변수](https://vercel.com/docs/environment-variables).
