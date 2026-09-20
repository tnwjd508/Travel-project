# Vercel 통합 컨테이너 배포

2026-09-20. **배포 파일 준비 단계**다. 실제 컨테이너 이미지 빌드, Vercel 업로드·배포, 환경변수 등록, GitHub push는 별도 단계다.

## 구성

```text
브라우저 → Vercel → app 컨테이너
                     ├─ FastAPI: /api/* 및 dist/의 React 화면
                     └─ Node.js: 기존 TypeScript/LangGraph 월간 브리핑
                               ↘ Supabase / 관광 API / Gemini
```

`vercel.json`의 `services.app`이 `Dockerfile.vercel`을 빌드한다. 최상위 `/(.*)` rewrite는 경로를 바꾸지 않고 app 서비스로 전달한다. API 경로를 `/index.html`로 바꾸지 않는다. 기존 `api/*.ts`의 외부 서버 프록시는 컨테이너 안에서 실행하지 않으며, 최종 이미지에도 포함하지 않는다.

- `Dockerfile.vercel`: Node 22 / Debian bookworm에서 `npm ci`, React 빌드, 운영 npm 의존성 정리. Python 3.12 / 같은 Debian 버전에 Node 실행 파일·운영 의존성·빌드 결과·서버 소스를 복사한다. Node 실행에 필요한 `libstdc++6`를 설치하고 일반 사용자 UID 10001로 실행한다.
- `.dockerignore`: 실제 빌드에 필요한 파일만 허용한다. `.env`·키 파일·가상환경·로컬 의존성·원시 분석 자료·테스트 산출물은 제외한다.
- `.vercelignore`: CLI 업로드에서도 같은 범위만 허용한다. Dockerfile만 추가하고 로컬 비밀 파일 전체를 업로드하는 상황을 방지한다.
- `backend/container.py`: `PORT`를 읽고 FastAPI를 `0.0.0.0`에 실행한다. 로컬 `.env`와 바탕화면 파일은 읽지 않는다. 기존 Node 워커는 FastAPI lifespan에서 함께 정리한다.

기존 `server/briefing/` 구현, 사용자 JWT·기관 권한 검증, Supabase 테이블·데이터는 변경하지 않는다. 개발용 수집 상태 패널은 프로덕션 빌드에서 계속 숨긴다.

## 실행 전 설정

컨테이너의 인증 정보는 **실행 환경변수**로만 전달한다. Dockerfile의 `ARG`/`ENV`나 이미지 레이어에 실제 키를 넣지 않는다.

| 변수 | 설정 |
|---|---|
| PORT | **8000**. Vercel 프로젝트에도 명시적으로 등록한다. |
| SUPABASE_URL | 현재 사용하는 Supabase 프로젝트 URL |
| SUPABASE_PUBLISHABLE_KEY | 공개 로그인 키 |
| SUPABASE_SECRET_KEY | 서버 전용 키. 기존 JWT 방식이면 SUPABASE_SERVICE_ROLE_KEY 사용 |
| TOUR_API_SERVICE_KEY | 실제 관광 API 키 값 |
| GEMINI_API_KEY, GEMINI_MODEL | 월간 AI 브리핑 설정 |
| TOUR_API_INDEX_BASE_YM, TOUR_API_VISITOR_BASE_YM | 확인한 지표 기준월. 현재 기본값 202608 / 202607 |
| VWORLD_API_KEY, VWORLD_DOMAIN | VWorld 사용 시 실제 키·등록 도메인 |

**FASTAPI_BASE_URL과 FASTAPI_PROXY_TOKEN은 이 구성에 등록하지 않는다.** 브라우저와 API가 같은 서비스에 있으므로 별도 서버 프록시가 없다. 기존 Vercel 프로젝트에 토큰이 남아 있으면 브라우저 요청이 전부 401이 되는 대신, 새 진입점이 명확한 설정 오류로 시작을 중단한다. 토큰 값을 로그에 출력하거나 조용히 무시하지 않는다. 사용자 로그인과 기관별 권한 검사는 그대로 작동한다.

Vercel의 기본 컨테이너 접속 포트는 80이므로 프로젝트에 **PORT=8000**을 반드시 설정한다. 이미지의 `EXPOSE 8000`만으로 플랫폼 설정을 대신하지 않는다.

## 로컬 Docker 확인

Docker CLI와 Linux 컨테이너 엔진이 준비된 환경에서 프로젝트 루트에서 실행한다.

```powershell
docker build --platform linux/amd64 -f Dockerfile.vercel -t ongil-travel:local .

# 설정한 PowerShell의 환경변수 값만 전달한다. 키를 명령문에 직접 쓰지 않는다.
docker run --rm --name ongil-travel-local -p 127.0.0.1:18000:8000 -e PORT=8000 -e SUPABASE_URL -e SUPABASE_PUBLISHABLE_KEY -e SUPABASE_SECRET_KEY -e TOUR_API_SERVICE_KEY -e GEMINI_API_KEY -e GEMINI_MODEL ongil-travel:local
```

기존 로컬 FastAPI 8000 포트는 유지하고, 컨테이너만 18000 포트로 확인한다. legacy 키를 쓰면 `-e SUPABASE_SERVICE_ROLE_KEY`로 대체한다. VWorld 사용 시 관련 변수도 전달한다.

검증 URL:

- `http://127.0.0.1:18000/api/health`: 프로세스 응답
- `http://127.0.0.1:18000/api/ready`: DB/RPC·분석 자료 등록·런타임 준비 여부
- `http://127.0.0.1:18000/dashboard/gwangju/donggu/overview`: React 화면
- `http://127.0.0.1:18000/api/policy-evidence?district=donggu&policy=festival`: 기존 등록 자료 조회

`ready` 응답만으로 실제 Gemini 생성이나 로그인·저장이 검증되지는 않는다. 등록한 계정으로 검토 저장·재조회까지 확인한 뒤 배포를 진행한다.

## Vercel 적용 시

1. 검증한 소스·배포 파일을 GitHub에 반영한다. 프로젝트 Root Directory는 저장소 루트다.
2. 기존 프로젝트의 Vite 전용 Install/Build/Output Directory override를 정리하고, 저장소의 Services/Container 설정이 적용되는지 빌드 로그에서 확인한다. Node 설치와 React 빌드는 Dockerfile에서 수행한다.
3. 위 환경변수를 Preview/Production 각각의 필요한 환경에 등록한다. 로컬 PowerShell 값은 자동 전달되지 않는다.
4. Preview에서 컨테이너 빌드·기동·라우팅·JWT 권한·저장·재조회·월간 브리핑을 확인한 뒤 운영 배포로 진행한다.

컨테이너 함수의 최대 실행 시간은 `services.app.functions["Dockerfile.vercel"].maxDuration = 300`이다. 기존 Python 브리핑 대기는 최대 285초다. 배포 환경의 기동 지연과 실제 요청 시간을 확인해야 한다.

## 검증 범위와 운영 한계

- 공식 Vercel JSON 스키마 검사 통과. Python/API/축제 분석 94건(신규 기동 검사 10건 포함), Node 86건, LangGraph 17건으로 총 197건 및 React 프로덕션 빌드 통과.
- 배포 제외 규칙과 Dockerfile의 명시적인 COPY 목록을 확인한다. 실제 Docker 엔진의 빌드 컨텍스트 및 이미지 레이어 검사는 이미지 빌드 시 추가로 수행한다.
- 컨테이너 진입점의 포트·설정 검사, React/API 서빙, 실제 Node 브리핑 모듈 기동을 로컬에서 검증한다. 테스트는 운영 키·원격 DB 쓰기·AI 생성을 사용하지 않는다.
- 현재 PC에는 Docker/Podman 실행기가 없어 **Linux 이미지 빌드와 Vercel Preview 배포는 아직 검증하지 못했다.** 파일 준비·로컬 진입점 검증을 실제 클라우드 배포 성공으로 취급하지 않는다.
- 컨테이너는 유휴 시 종료될 수 있다. 월간 브리핑·검토 기록은 Supabase에 보존하지만, 일반 관광 API의 메모리 캐시·호출 예산은 인스턴스별이다. 여러 인스턴스로 확장하면 전체 서비스의 전역 할당량이 되는 것은 아니다.
- Hobby의 이용 조건·무료 사용량과 컨테이너 베타 지원은 실제 배포 시 계정에서 확인한다. Gemini 등 외부 API 비용은 별도다.

공식 문서 확인일: 2026-09-20. [Container Images](https://vercel.com/docs/functions/container-images), [Services](https://vercel.com/docs/services), [Service configuration](https://vercel.com/docs/services/config-reference), [Functions limits](https://vercel.com/docs/functions/limitations).
