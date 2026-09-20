# Vercel 통합 컨테이너 환경변수 설정

2026-09-20. 현재 `vercel.json`은 **React + FastAPI + Node.js를 하나의 컨테이너에 배포**하도록 구성돼 있다. 실제 Vercel 배포는 아직 실행하지 않았다. 배포 파일·Docker 명령·검증 절차는 [통합 컨테이너 배포 안내](docs/vercel-container-deployment.md)를 따른다.

| 위치 | 환경변수 | 설명 |
|---|---|---|
| Vercel 컨테이너 | PORT | 8000. 플랫폼과 컨테이너의 포트를 맞춘다. |
| Vercel 컨테이너 | SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY | 현재 프로젝트 URL·향후 Auth API/readiness 호환용 공개 키 |
| Vercel 컨테이너 | SUPABASE_SECRET_KEY 또는 SUPABASE_SERVICE_ROLE_KEY | 서버 전용 DB 키 |
| Vercel 컨테이너 | TOUR_API_SERVICE_KEY | 실제 관광공사 인증키 값 |
| Vercel 컨테이너 | GEMINI_API_KEY, GEMINI_MODEL | 월간 AI 브리핑 |
| Vercel 컨테이너 | TOUR_API_INDEX_BASE_YM, TOUR_API_VISITOR_BASE_YM | 검증한 기준월. 기본 202608 / 202607 |
| Vercel 컨테이너 (선택) | VWORLD_API_KEY, VWORLD_DOMAIN | 실제 VWorld 키와 등록 도메인 |

Vercel 프로젝트의 Environment Variables에서 적용할 Preview/Production 환경을 선택해 등록하고 새로 배포한다. 로컬 PowerShell의 값과 바탕화면 키 파일은 Vercel로 전달되지 않는다. 키에 `VITE_` 접두사를 붙이지 않는다.

**현재 통합 구성에는 FASTAPI_BASE_URL / FASTAPI_PROXY_TOKEN을 등록하지 않는다.** API는 같은 컨테이너에서 직접 처리한다. 토큰이 남아 있으면 `backend.container`가 시작을 중단하므로, 이전 분리 배포용 설정을 제거해야 한다. 공모전 화면은 로그인 없이 지도에서 선택한 정규 지자체 ID를 브리핑 조회 컨텍스트로 사용한다.

기존 `api/*.ts` 프록시 코드는 보존돼 있지만 이 컨테이너 배포에서는 실행하지 않는다. 이전처럼 Vercel 화면과 외부 FastAPI를 분리하는 구조를 다시 선택할 때만 FASTAPI_BASE_URL과 양쪽의 같은 FASTAPI_PROXY_TOKEN을 사용한다.

개발용 API 상태·원시 근거는 프로덕션 빌드에서 항상 숨긴다. 로컬 Vite에서 명시적으로 `VITE_SHOW_DIAGNOSTICS=true`를 지정한 경우에만 표시한다.
