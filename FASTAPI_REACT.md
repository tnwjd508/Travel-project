# ON:GIL · FastAPI + React 실행 및 인수

## 반영한 저장소 상태

**2026-09-18 통합:** 팀원 PR #7 `work-from-main`의 `888a93b`를 로컬 `JSBbranch`에 병합했다. 전국 화면과 LangGraph 코드를 보존하면서 FastAPI에 전국 코드 지원과 월간 브리핑 워커 연결을 추가했다. 현재 변경·검증·운영 한계는 [PR #7 통합 기록](docs/팀원_PR7_FastAPI_통합_기록.md)을 참고한다. 아래 2026-09-17 항목은 최초 구현 기록이다.

2026-09-17 `tnwjd508/Travel-project`를 확인했다. 기본 브랜치는 `master`(`935173d`, PR #5 병합), `main`은 `e425980`(PR #6 병합)이었다. 작업 브랜치 `JSBbranch`의 `8531956`에서 `origin/main`까지 fast-forward로 최신 변경을 반영한 뒤 이 작업을 적용했다. 진행 중 축제 UI를 보존하고 데이터 경로를 새 API로 연결했다. 원격 push와 운영 배포는 수행하지 않았다.

## 구조와 구현 범위

```text
개발: React/Vite :5173 → /api 프록시 → FastAPI :8000 → 한국관광공사 / VWorld
단독 운영: FastAPI → dist/의 React 정적 파일 + /api
분리 운영: Vercel React → Vercel API 어댑터 → HTTPS FastAPI
```

- `backend/app.py`: FastAPI 진입점, lifespan HTTPX 연결 풀, 오류 처리, Swagger, 정적 React 서빙.
- `backend/core.py`: 외부 API 허용 목록, 키 보호, 동시 호출 6개, 요청당 25초/80회, operation별 UTC 일일 900회, TTL 캐시와 동일 요청 합치기.
- `backend/district.py`: 전국 지역 코드·완월 검증·8개 리소스 집계. 광주 `all` 호환 범위는 5개 구다. `backend/diagnosis.py`: 검토용 draft-1 규칙.
- `backend/briefing.py` → `server/briefing/bridge.ts`: 팀원의 LangGraph 월간 서비스를 상주 Node 워커로 실행한다. 같은 서비스 인스턴스의 캐시·동시 실행 제한을 유지한다. `tsx`는 운영 의존성이다.
- `src/services/districtApi.ts`, `src/hooks/useDistrictResource.ts`: 타입 계약, 구 변경 시 이전 데이터 제거, 취소·로딩·오류·재시도·빈 데이터 처리.
- 개요 KPI, 방문 추이, 연령 지수, 콘텐츠 구성, 지도 관광지 좌표, 연관 관광지, 진단, 순위, 보고서를 API와 연결했다. 현재 개요는 팀원의 월간 브리핑과 최근 종료/예정 축제를 사용한다. 이전 진행 중 축제 컴포넌트는 파일로 보존했다.
- 보고서 생성 시 조회한 데이터의 복사본을 고정한다. 화면을 벗어나면 스냅샷은 해제된다. DB 저장 기능은 포함하지 않는다.
- 정책 시뮬레이션과 전략 비교의 기존 가정값은 시나리오 예시임을 화면에 명시했다. 학습된 AI 예측·검증된 정책 인과효과가 아니다.
- 기존 `server/aggregate`, `server/district.ts` 등 TypeScript 집계 코드는 계약 비교 및 회귀 테스트용으로 보존했다. 기본 API 엔진은 FastAPI이며, `api/*.ts`는 분리 배포용 전달 어댑터다(공개 지역 목록은 팀원 TS 함수 유지). LangGraph 수집·생성 로직은 TS 워커를 실제로 사용한다.

## 설치와 실행

Python 3.12 이상, Node.js 22 이상을 권장한다. 프로젝트 루트에서 실행한다.

```powershell
python -m venv .venv
& .venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
npm ci
npm run dev -- --key-file 'C:/Users/subin/OneDrive/바탕 화면/env.txt'
```

인증키 파일은 `TOUR_API_SERVICE_KEY=값` 또는 `인증키 : 값` 형식을 지원한다. 원본을 수정하거나 작업 폴더에 복사하지 않는다. `--key-file` 값은 해당 프로세스에서만 사용하며 환경 파일보다 우선한다. 파일을 사용하지 않을 때는 서버 프로세스 환경변수 또는 `.env.local`/`.env`에 `TOUR_API_SERVICE_KEY`를 설정하고 `npm run dev`를 실행한다. 이 폴더는 공유 폴더이므로 실제 키 파일을 추가하면 다른 장치에도 동기화될 수 있다.

통합 실행은 `--key-file`, `--reload`만 받으며 FastAPI 8000 포트를 사용한다. `Ctrl+C`로 두 서버를 종료한다. Vite 주소는 콘솔에 출력한다(기본 5173, 사용 중이면 다음 포트). 기존 FastAPI가 실행 중이면 `npm run dev:web`만 실행한다.

서버를 따로 실행하거나 포트를 바꾸려면:

```powershell
& .venv/Scripts/python.exe -m backend.run --port 8001 --key-file 'C:/Users/subin/OneDrive/바탕 화면/env.txt'
# 다른 터미널
$env:FASTAPI_BASE_URL = 'http://127.0.0.1:8001'
npm run dev:web
```

macOS/Linux에서는 `.venv/Scripts/python.exe` 대신 `.venv/bin/python`을 사용한다. 실행 환경에 따라 `PYTHON_EXECUTABLE`로 통합 실행의 Python 절대 경로를 지정할 수 있다.

- API 문서: `http://127.0.0.1:8000/docs`
- 상태: `http://127.0.0.1:8000/api/health`
- 예: `/api/district/summary?district=donggu`, `/api/district/summary?district=all`
- 상세 파라미터·응답 의미: [BACKEND_API.md](BACKEND_API.md), [src/types/district.ts](src/types/district.ts)

## 데이터 설정과 해석

| 서버 환경변수 | 용도 |
| --- | --- |
| `TOUR_API_SERVICE_KEY` | 관광공사 API 인증키, FastAPI에만 설정 |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | 월간 브리핑 AI 생성용. FastAPI에만 설정. 키 미설정/생성 실패 시 실제 수집 근거를 유지 |
| `TOUR_API_INDEX_BASE_YM` | 지수 최대/기본 기준월, 기본 `202608` |
| `TOUR_API_VISITOR_BASE_YM` | 방문자 최대/기본 기준월, 기본 `202607` |
| `VWORLD_API_KEY`, `VWORLD_DOMAIN` | 선택적 VWorld 경계 조회. 미설정 시 포함된 2025-06-30 정적 경계 사용 |
| `FASTAPI_BASE_URL` | Vite 또는 Vercel에서 연결할 FastAPI 주소 |
| `FASTAPI_PROXY_TOKEN` | 분리 운영 시 FastAPI와 Vercel에 같은 서버 전용 비밀값 설정 |

`VITE_` 접두사로 인증키·서버 토큰을 만들지 않는다. 기준월은 자동 최신월 탐지가 아니며, 실제 완월 데이터를 확인한 뒤 서버 설정을 갱신한다. 통계 지역코드는 2026-07, 수요 API는 2026-08부터 전환한다. 관광 콘텐츠는 별도 법정동 코드를 사용한다.

방문자는 **일별 추정 방문자 합계**다. 날짜 또는 내국인/외지인/외국인 구분이 하나라도 누락되면 월 합계를 `null`로 표시한다. 체류·소비 등은 상대 지수이며 시간·금액으로 바꾸지 않는다. 콘텐츠·축제는 조회 시점/행사일 기준이다. 순위는 수집된 전국 시군구 집합에서 계산하며 행정구역 전체 모집단을 검증한 순위가 아니다. 자체 활성화 지수와 진단은 `draft-1`, `provisional`을 명시한다.

## 검증

```powershell
& .venv/Scripts/python.exe -m pytest backend/tests -q
npm test
npm run test:briefing
npm run build
# FastAPI가 실행 중일 때, 실제 외부 API 호출량을 소비하는 검사
node scripts/smoke-district.mjs --base-url http://localhost:5173 --full-history
```

2026-09-17 검증 결과:

- FastAPI 단위·통합 19개: 코드 전환, 완월 누락, 중복, 키 비노출, 오류, 요청 예산, 동시 조회 합치기, 취소 후 캐시 재사용, 캐시 만료 전파, origin 인증, VWorld 빈 응답 재시도, 8개 계약, 진단 최초 호출 19회.
- TypeScript 24개 계약/집계 회귀 테스트 및 프로덕션 빌드 통과. 빌드에는 기존 GIS 자산 등을 포함한 500kB 초과 청크 경고가 남아 있다. Python 테스트에는 설치된 Starlette/AnyIO의 deprecation 경고 2건이 있다.
- 실제 FastAPI → Vite HTTP 검증: 8개 리소스와 5개 구 요약 전부 200. 49개 지수 누락 없음. 방문 12개월과 전년 동월 12개월 완월 확인.
- 동구 확인값: 202607 방문 추정치 합계 `5,304,194.08`, 202608 체류강도 `72.15`, 관광 콘텐츠 124건, 전국 관측 256개 시군구 중 체류지수 137위.
- 실제 브라우저에서 지역 진입, 분석 탭, 지도, 진단, 요청 시 순위, 보고서 생성/인쇄 버튼과 동구→서구 전환을 확인했다. 390px 모바일 개요·분석 화면에서 가로 넘침이 없었다.

## 운영 실행과 배포 경계

단독 서버는 `npm run build` 후 `python -m backend.run`으로 React와 API를 같은 출처에서 제공한다. `/dashboard/gwangju/donggu/overview` 직접 접근도 지원한다. 외부 제공 시 서비스 관리자의 재시작 설정, HTTPS reverse proxy와 요청 제한을 구성한다. `--reload`는 개발 전용이다.

Vercel 분리 배포는 먼저 FastAPI 서버를 배포해야 한다. Vercel에 `FASTAPI_BASE_URL=https://실제-FastAPI-주소`, 양쪽 서버에 충분히 긴 동일한 `FASTAPI_PROXY_TOKEN`을 설정한다. Vercel 어댑터가 헤더에 토큰을 넣고 FastAPI가 `/api/*`를 검증한다(`/api/health` 제외). 토큰은 브라우저에 전달하지 않는다. 로컬 통합 실행이나 FastAPI 단독 공개 서빙에서는 이 토큰을 비워 둔다. 분리 배포 토큰이 활성화된 origin의 Swagger 호출도 서버 인증이 필요하다.

캐시·일일 예산은 **프로세스 단위 메모리**이며 재시작하면 초기화된다. Python 데이터 엔진과 Node 브리핑 워커 예산은 별개로, 공급자 전체 쿼터를 합산하지 않는다. 다중 worker/replica 배포 전 Redis 등 공유 예산·캐시 및 ingress 요청 제한이 필요하다. 프록시 토큰은 origin 우회 방지용이며 사용자별 rate limit을 대체하지 않는다. 사용자 로그인, 운영 DB, 자동 월 수집 스케줄러, 운영 배포는 이 변경에 포함되지 않는다.
