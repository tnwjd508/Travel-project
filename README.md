# frontend-co · ON:GIL

> main의 대시보드와 FastAPI를 유지하면서 전국 지도 진입 및 월별 DB 저장 브리핑을 연결했습니다. 독립 전국지역브리핑 페이지는 제거했습니다. 현재 화면 흐름은 [전국 지역 정보 조회 사용법](docs/전국_지역_매핑_사용법.md), 월별 저장과 서버 설정은 [월간 브리핑 DB 설정](docs/월간_브리핑_DB_설정_및_운영.md)을 참고하세요. 아래 표와 기록 중 독립 브리핑·DB 미포함 설명은 통합 전 기준입니다.

광주광역시 관광 데이터를 바탕으로 지역 현황을 탐색하고, 정책 시뮬레이션부터 전략 비교와 보고서 출력까지 이어지는 **AI 지역 관광전략 프론트엔드**입니다.

이 프로젝트는 **React 프런트엔드와 FastAPI 백엔드**를 포함합니다. 팀원 PR #7의 전국 지역 선택·LangGraph 월간 브리핑을 반영했습니다. [팀원 변경 통합 기록](docs/팀원_PR7_FastAPI_통합_기록.md), [설치·실행](FASTAPI_REACT.md), [8개 API 계약](BACKEND_API.md)을 참고하세요.

## 현재 구현 상태

| 영역 | 상태 | 내용 |
| --- | --- | --- |
| 지역 선택 랜딩 | 구현 완료 | 대한민국 시도 지도, 주요 지역 선택, 전국 시군구 브리핑 진입 |
| 광주 대시보드 | 구현 완료 | 개요, 관광 분석, AI 진단, 정책 시뮬레이션, 전략 비교, 보고서 화면 |
| 광주 행정동 지도 | 구현 완료 | 5개 자치구·96개 행정동 경계, hover/선택, 구 필터, 확대·축소, 경계 레이어 전환 |
| 정책 시뮬레이션 상태 | 구현 완료 | 정책·예산·기간 선택 및 결과를 브라우저에 유지 |
| 보고서 | 구현 완료 | 분석 결과 확정, 인쇄 및 PDF 저장용 레이아웃 |
| TourAPI 프록시 | 구현 완료 | Vite/Vercel → FastAPI → 관광공사, 인증키 FastAPI 서버 보관 |
| 광주 데이터 API | 구현 완료 | 요약·방문자·49개 지수·콘텐츠·축제·연관관광지·전국 순위·검토용 자체 진단 |
| 실데이터 연동 | 구현 완료 | 개요 KPI·방문 차트·지수·콘텐츠·지도 좌표·축제·진단·순위·보고서 연결 |
| 정책 효과 모델 | 예시 단계 | 정책 시뮬레이션·전략 비교는 가정값이며 화면에 명시 |
| 전국 지역 브리핑 | 구현 완료 | 16개 시도·269개 시군구 목록, 관광 정보·월간 근거·최근/예정 축제 |
| 월간 AI 생성 | 연결 구현 | 팀원 LangGraph/Gemini 코드 유지. 현재 키 미설정으로 실제 AI 생성 성공은 미검증 |
| 전국 상세 지도·정책 화면 | 범위 외 | 기존 광주 상세 대시보드 범위를 유지 |

## 주요 기능

### 지역 선택

- `@svg-maps/south-korea` 기반 대한민국 시도 지도
- 광주, 서울, 부산, 대구, 인천, 제주 선택 UI
- 광주 대시보드 진입 애니메이션
- 전국 시도·시군구 선택과 관광 정보·월간 브리핑 조회

### 광주 관광 분석

- 월별 관광객, 연령대, 관광 유형 차트
- 광주 5개 자치구와 96개 행정동 경계 시각화
- 행정동 hover 및 클릭 상세 정보
- 자치구별 강조 필터와 행정동 경계 표시 전환
- 관광지 경·위도 좌표를 행정동 지도에 투영

행정동 구성은 다음과 같습니다.

| 자치구 | 행정동 수 |
| --- | ---: |
| 동구 | 13 |
| 서구 | 18 |
| 남구 | 17 |
| 북구 | 27 |
| 광산구 | 21 |
| **합계** | **96** |

### 정책 의사결정 흐름

1. 관광 KPI와 공간 분포 확인
2. AI 진단 화면에서 핵심 문제와 우선 과제 확인
3. 정책·예산·시행 기간을 조절해 가정에 따른 시나리오 탐색
4. 전략별 예시 효과, 예산, 난이도 비교
5. 실데이터와 진단 근거를 보고서 스냅샷으로 확정하고 인쇄 또는 PDF 저장

## 기술 스택

- React 18
- FastAPI / Python / HTTPX / Uvicorn
- TypeScript 5.7
- Vite 6
- React Router
- Tailwind CSS
- Framer Motion
- Recharts
- Zustand
- Radix UI
- Lucide React

## 시작하기

### 요구 사항

- Node.js 22 이상 권장
- npm
- TourAPI 연동 시 공공데이터포털 일반 인증키(Decoding)
- Python 3.12 이상 (FastAPI 서버 실행)

### 설치 및 실행

```powershell
python -m venv .venv
& .venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
npm ci
npm run dev -- --key-file 'C:/Users/subin/OneDrive/바탕 화면/env.txt'
```

인증키 파일 대신 서버 환경 파일을 사용할 경우 다음처럼 복사한 후 실제 값을 설정하고 `npm run dev`를 실행합니다. 실제 키는 공유 폴더에 복사하지 않는 방식을 권장합니다.

```powershell
Copy-Item .env.example .env.local
```

개발 서버가 실행되면 기본적으로 다음 주소에서 확인할 수 있습니다.

```text
http://localhost:5173
```

## 환경 변수

`.env.local`에 공공데이터포털에서 발급받은 일반 인증키(Decoding)를 입력합니다.

```env
TOUR_API_SERVICE_KEY=your_decoding_service_key_here
```

인증키에는 `VITE_` 접두사를 붙이지 않습니다. `VITE_` 환경 변수는 브라우저 번들에 포함될 수 있습니다.

로컬 연결 확인:

```text
http://localhost:5173/api/tourism?endpoint=areaCode2&numOfRows=1&pageNo=1
```

응답의 `resultCode`가 `0000`이면 정상입니다. 자세한 설정은 [TOUR_API_SETUP.md](./TOUR_API_SETUP.md)를 참고하세요.

## 사용 가능한 명령어

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | FastAPI + Vite 통합 실행 |
| `npm run dev:web` | 별도로 실행 중인 FastAPI에 연결할 Vite만 실행 |
| `npm run build` | TypeScript 검사 후 프로덕션 빌드 |
| `npm run preview` | 정적 빌드만 미리보기. API 통합 확인은 FastAPI 정적 서빙 사용 |
| `npm test` | 기존 TypeScript 계약 회귀 테스트 |
| `npm run test:briefing` | 팀원 LangGraph·근거·축제·브리핑 검사 |
| `npm run export:regions` | 팀원의 TS 지역 목록을 FastAPI용 JSON으로 동기화 |
| `.venv/Scripts/python.exe -m pytest backend/tests -q` | FastAPI 테스트 |

## 화면 경로

| 경로 | 화면 |
| --- | --- |
| `/` | 지역 선택 랜딩 |
| `/dashboard/gwangju/overview` | 광주 관광 개요 |
| `/dashboard/gwangju/analytics` | 관광 차트 및 96개 행정동 지도 |
| `/dashboard/gwangju/diagnosis` | AI 지역 진단 |
| `/dashboard/gwangju/simulation` | 정책 시뮬레이션 |
| `/dashboard/gwangju/strategy` | 전략 비교 |
| `/dashboard/gwangju/report` | 전략 보고서 및 PDF 출력 |

## 프로젝트 구조

```text
frontend-co/
├─ backend/                     # FastAPI 집계·진단·HTTPX·테스트
├─ api/
│  └─ tourism.ts                 # Vercel → FastAPI 전달 어댑터
├─ scripts/
│  └─ generate_gwangju_map.py    # Shapefile → 행정동 SVG 데이터 변환
├─ server/
│  └─ fastApiProxy.ts            # Vercel 서버 간 프록시 (기존 TS 집계도 보존)
├─ src/
│  ├─ assets/data/               # 샘플 관광 데이터와 행정동 지도 데이터
│  ├─ components/
│  │  ├─ dashboard/              # 차트, 지도, 진단, 시뮬레이션 컴포넌트
│  │  ├─ landing/                # 지역 선택 랜딩 컴포넌트
│  │  ├─ navigation/             # 헤더 및 내비게이션
│  │  └─ ui/                     # 공통 UI 컴포넌트
│  ├─ data/                      # 지역 및 정책 정의
│  ├─ layouts/                   # 대시보드 레이아웃
│  ├─ pages/                     # 라우트별 페이지
│  ├─ services/                  # 브라우저용 TourAPI 클라이언트
│  ├─ stores/                    # Zustand 상태 저장소
│  ├─ styles/                    # 전역 스타일
│  └─ types/                     # 공통 TypeScript 타입
├─ .env.example
├─ TOUR_API_SETUP.md
└─ package.json
```

## 광주 행정동 지도 데이터

브라우저가 대용량 전국 Shapefile을 직접 읽지 않도록, 광주 행정동만 추출해 경량 JSON으로 사용합니다.

- 원본 기준일: 2025-06-30
- 원본 좌표계: EPSG:5179
- 출력 파일: `src/assets/data/gwangju-neighborhood-map.json`
- 출력 범위: 광주광역시 5개 자치구, 96개 행정동

생성된 JSON이 저장소에 포함되어 있으므로 일반적인 개발·빌드 과정에서는 원본 Shapefile이 필요하지 않습니다.

원본을 갱신할 때는 프로젝트와 같은 상위 폴더에 다음 구조를 준비합니다.

```text
parent-directory/
├─ frontend-co/
└─ bnd_all_00_2025_2Q/
   └─ bnd_dong_00_2025_2Q.zip
```

이후 다음 명령을 실행합니다.

```bash
python scripts/generate_gwangju_map.py
```

스크립트는 외부 Python 패키지 없이 Shapefile을 읽고, EPSG:5179 좌표를 지도용 경로로 변환하며, 웹 표시를 위해 경계를 단순화합니다.

## TourAPI 프록시 구조

브라우저는 인증키를 직접 사용하지 않고 `/api/tourism`으로 요청합니다.

```text
React UI
   ↓ /api/tourism
로컬 Vite 프록시 또는 Vercel Function
   ↓ FastAPI 서버 (외부 API 허용 목록·캐시·호출 한도)
   ↓ serviceKey 추가
한국관광공사 KorService2
```

현재 허용된 주요 기능은 지역 코드, 지역·위치 기반 목록, 키워드·축제·숙박 검색, 콘텐츠 상세, 이미지, 법정동 코드 조회입니다. 엔드포인트와 전달 파라미터는 서버에서 허용 목록으로 제한합니다.

## 데이터 및 상태 관련 참고

- `src/assets/data/gwangju-tourism.json`의 관광 지표는 현재 화면 구성과 시뮬레이션 흐름을 검증하기 위한 샘플 데이터입니다.
- 정책 시뮬레이션 결과는 `localStorage`의 `ongil-tourism-strategy` 키에 저장됩니다.
- 행정동 지도 위 관광지는 관광공사 콘텐츠 좌표를 사용합니다. 관광지별 방문객 수는 제공되지 않아 표시하지 않습니다.
- KPI·진단 근거는 실제 API를 사용합니다. 자체 진단은 검토용 draft-1이며 학습된 예측 모델이 아닙니다.

## 배포

Vercel 분리 배포는 별도 FastAPI 서버가 필요합니다. Vercel에 다음 환경 변수를 등록하고, FastAPI에는 관광공사 인증키와 같은 `FASTAPI_PROXY_TOKEN`을 설정합니다.

```text
FASTAPI_BASE_URL
FASTAPI_PROXY_TOKEN
```

Production, Preview, Development 환경에 필요한 값을 설정하고 재배포해야 합니다. 인증키가 포함된 `.env.local`은 Git에 커밋하지 않습니다. FastAPI 단독 서빙과 운영 한계는 [FASTAPI_REACT.md](FASTAPI_REACT.md)를 참고하세요.
# Supabase 공동 저장

최신 master·SJbranch를 함께 반영한 로컬 상태와 다음 백엔드 구현은 [FastAPI 구현 방향](docs/fastapi-implementation-plan.md)에 정리돼 있습니다.

현재 권고 구조는 [2026-09-20 데이터베이스 재설계](docs/supabase-database-design.md)를 참고하세요. 월간 브리핑·기관별 시나리오에 과거 축제 근거 버전과 검토 스냅샷을 연결합니다. [이전 통합 기록](docs/supabase-integrated-design.md)은 로컬 구현 이력이며, 새로운 검토 API와 원격 DB 적용은 아직 완료되지 않았습니다.
