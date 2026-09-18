# PR #7 팀원 변경과 FastAPI 통합 기록

## 확인한 진행 상황 (2026-09-18)

- GitHub 기본 브랜치 `master`: `935173d`. `main`: `e425980`.
- 열린 PR [#7](https://github.com/tnwjd508/Travel-project/pull/7), `work-from-main`: `888a93b` — 전국 코드 매핑과 월간 관광 브리핑.
- 기존 우리 작업을 먼저 로컬 커밋 `1146148`로 보존하고, `origin/work-from-main`을 `JSBbranch`에 merge했다. 팀원 커밋과 작성자 이력을 유지한다. 원격 PR 병합·push·운영 배포는 하지 않았다.

## 팀원 구현을 보존한 부분

`server/briefing/data.ts`, `graph.ts`, `service.ts`, `src/components/dashboard/MonthlyBriefing.tsx`, `src/pages/regions/NationalRegionPage.tsx`, `src/data/tourismRegions.ts`, `tourismRegionCatalogue.ts`는 팀원 커밋과 동일하다. 원본과 diff가 없음을 확인했다.

전국 선택 화면, 16개 시도·269개 시군구 매핑, 세종 및 개편 전 코드, 24개월 월 선택, 10개 출처의 LangGraph/Gemini 순차 병합, 근거 인용 검증, 최근 종료/예정 축제 분류, 팀원 테스트와 문서를 유지했다. 개요의 브리핑을 `MonthlyBriefing`으로 바꾸는 팀원 의도도 유지했다. 이전 `DailyBriefing`·`OngoingFestivals` 파일은 보존하되 개요에서 중복 렌더링하지 않는다. 우리 규칙 기반 진단은 기존 진단 페이지와 보고서에서 계속 제공한다.

## 통합에 필요한 수정

1. `package.json`, `vite.config.ts` 충돌: 팀원 의존성과 명령을 유지하면서 FastAPI+Vite 통합 실행을 유지했다. 월간 브리핑에는 별도 장시간 프록시 제한을 적용했다.
2. Python 전국 지원: 팀원의 TS 목록에서 `backend/data/tourism-regions.json`을 생성한다. `npm run export:regions`로 동기화하고 `npm test`에서 두 목록의 일치를 확인한다. `npm run sync:regions`와 빌드에도 동기화를 연결했다. 목록은 TS 파일이 단일 원본이다.
3. `backend/regions.py`와 집계 연결: `regionId` 소속 검증, 숫자 시군구 ID, 광주 별칭, 세종 콘텐츠/통계 코드, 개편 전 코드를 동일하게 지원한다. 월 방문 원본은 한 번 읽고 지역별로 분리하며, `summary?district=all`은 광주 5개 구 범위를 유지한다.
4. 브리핑 연결: FastAPI가 필요할 때 Node 워커 하나를 시작해 표준 입출력으로 요청한다. 팀원의 서비스 인스턴스를 유지하므로 캐시·동일 요청 합치기·2건 동시 생성 제한이 그대로 적용된다. 브라우저에 Node 포트나 키를 노출하지 않는다. 종료·비정상 종료 후 재기동을 테스트했다.
5. Vercel 월간 API도 FastAPI로 전달한다. TOUR/GEMINI 키는 FastAPI에만 설정한다. 시간 제한은 팀원 그래프 240초 → FastAPI 250초 → Vercel 전달 255초 → UI 260초다. `/api/regions`의 공개 목록 함수는 팀원 구현을 그대로 유지한다.
6. `tsx`를 같은 버전의 운영 의존성으로 지정했다. Node 워커 어댑터에 요청당 80회·operation별 UTC 일일 900회 예산과 외부 redirect 차단을 추가했다. 이는 Python/Node 각각의 메모리 예산이며 둘을 합친 공급자 전체 쿼터가 아니다. 여러 프로세스 운영에는 공유 예산 저장소가 별도로 필요하다.
7. 설치 검사에서 발견한 `nanoid` 하위 의존성을 `3.3.17` → `3.3.19`로 패치했다. 현재 `npm audit` 취약점 0건이다. 팀원 주요 라이브러리 버전은 유지했다.

## 검증 결과

- `npm test`: 33개 통과 (팀원 전국 코드 테스트 포함).
- `npm run test:briefing`: 팀원 13개 그대로 통과.
- `python -m pytest backend/tests -q`: 29개 통과.
- `npm run build`: 통과. 기존 500kB 초과 청크 경고는 남아 있다.
- `npm ls --omit=dev tsx @langchain/langgraph`: 운영 의존성 확인. Node 워커의 실제 입출력 호출도 확인.
- 실제 FastAPI: 서울 종로구 839개, 부산 중구 190개, 세종 204개 관광 콘텐츠. 잘못된 시도·시군구 조합은 400.
- 실제 월간 브리핑: 서울 종로구 2026-08 응답 200, 10개 출처, 21개 근거, 최근/예정 축제 각 3개.
- 브라우저: 전국 목록, 종로구 정보·월간 브리핑, 서울→부산 변경 시 이전 결과 제거 확인. 광주 상세 화면과 실데이터 연결도 유지한다.

Gemini 키가 없는 현재 실행에서는 `aiStatus=unavailable`이며 실제 수집 근거만 표시한다. AI 모델의 실제 생성 성공을 검증했다고 주장하지 않는다. 팀원의 모델·프롬프트·축제 기준은 변경하지 않았다.

## 실행

기존 가상환경 설치 후 `npm ci`, `npm run dev -- --key-file <외부 관광공사 키 파일>`을 사용한다. 현재 실행 주소는 콘솔을 확인한다(기본 `http://localhost:5173`). 전국 화면은 `/regions`, 광주 상세는 `/dashboard/gwangju/donggu/overview`다.

AI 생성을 사용할 때는 FastAPI 환경에 `GEMINI_API_KEY`, `GEMINI_MODEL`을 설정하고 재시작한다. 월간 워커는 `.env`를 따로 읽지 않고 FastAPI의 허용된 서버 환경변수만 전달받는다. `npm ci --omit=dev`를 사용하는 운영 환경에서도 Node.js와 TS 원본(`server/`, 해당 `src/data/`, `src/types/`)을 포함해야 한다. React 빌드는 개발 의존성이 설치된 빌드 단계에서 수행한다.
