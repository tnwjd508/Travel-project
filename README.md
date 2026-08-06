# frontend-co · ON:GIL

광주광역시 관광 데이터를 바탕으로 지역 현황을 탐색하고, 정책 시뮬레이션부터 전략 비교와 보고서 출력까지 이어지는 **AI 지역 관광전략 프론트엔드**입니다.

이 문서는 `frontend-co` 저장소만 설명합니다. 외부 데이터 수집·전처리 파이프라인이나 별도 백엔드 프로젝트는 포함하지 않습니다.

## 현재 구현 상태

| 영역 | 상태 | 내용 |
| --- | --- | --- |
| 지역 선택 랜딩 | 구현 완료 | 대한민국 시도 지도, 6개 주요 지역 선택 UI, 준비 중 지역 안내 |
| 광주 대시보드 | 구현 완료 | 개요, 관광 분석, AI 진단, 정책 시뮬레이션, 전략 비교, 보고서 화면 |
| 광주 행정동 지도 | 구현 완료 | 5개 자치구·96개 행정동 경계, hover/선택, 구 필터, 확대·축소, 경계 레이어 전환 |
| 정책 시뮬레이션 상태 | 구현 완료 | 정책·예산·기간 선택 및 결과를 브라우저에 유지 |
| 보고서 | 구현 완료 | 분석 결과 확정, 인쇄 및 PDF 저장용 레이아웃 |
| TourAPI 프록시 | 구현 완료 | 로컬 Vite 프록시와 Vercel Serverless Function 제공, 인증키 서버 보관 |
| 실데이터 전면 연동 | 진행 중 | 일부 화면의 KPI·진단·추천 결과와 대표 관광지는 현재 샘플 데이터 사용 |
| 타 지역 대시보드 | 준비 중 | 현재 실제 진입 가능한 대시보드는 광주광역시만 제공 |

## 주요 기능

### 지역 선택

- `@svg-maps/south-korea` 기반 대한민국 시도 지도
- 광주, 서울, 부산, 대구, 인천, 제주 선택 UI
- 광주 대시보드 진입 애니메이션
- 미지원 지역 선택 시 데이터 연동 준비 안내

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
3. 정책·예산·시행 기간을 조절해 예상 효과 시뮬레이션
4. 전략별 기대효과, 예산, 난이도 비교
5. 선택 결과를 정책 보고서로 정리하고 인쇄 또는 PDF 저장

## 기술 스택

- React 18
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

- Node.js 18 이상
- npm
- TourAPI 연동 시 공공데이터포털 일반 인증키(Decoding)
- 행정동 지도 원본을 다시 생성할 때만 Python 3 필요

### 설치 및 실행

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Windows PowerShell에서는 환경 파일을 다음처럼 복사할 수 있습니다.

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
| `npm run dev` | Vite 개발 서버 실행 |
| `npm run build` | TypeScript 검사 후 프로덕션 빌드 |
| `npm run preview` | 프로덕션 빌드 로컬 미리보기 |

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
├─ api/
│  └─ tourism.ts                 # Vercel용 TourAPI 프록시
├─ scripts/
│  └─ generate_gwangju_map.py    # Shapefile → 행정동 SVG 데이터 변환
├─ server/
│  └─ tourApi.ts                 # TourAPI 요청 검증 및 공통 호출 로직
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
   ↓ serviceKey 추가
한국관광공사 KorService2
```

현재 허용된 주요 기능은 지역 코드, 지역·위치 기반 목록, 키워드·축제·숙박 검색, 콘텐츠 상세, 이미지, 법정동 코드 조회입니다. 엔드포인트와 전달 파라미터는 서버에서 허용 목록으로 제한합니다.

## 데이터 및 상태 관련 참고

- `src/assets/data/gwangju-tourism.json`의 관광 지표는 현재 화면 구성과 시뮬레이션 흐름을 검증하기 위한 샘플 데이터입니다.
- 정책 시뮬레이션 결과는 `localStorage`의 `ongil-tourism-strategy` 키에 저장됩니다.
- 행정동 지도 위 대표 관광지와 방문객 수는 현재 UI 시연용 값입니다.
- 실서비스 전환 시 KPI, 진단 근거, 정책 효과 계산 결과를 실제 수집·분석 API와 연결해야 합니다.

## 배포

Vercel 배포 시 프로젝트 설정에 다음 환경 변수를 등록합니다.

```text
TOUR_API_SERVICE_KEY
```

Production, Preview, Development 환경에 필요한 값을 설정하고 재배포해야 합니다. 인증키가 포함된 `.env.local`은 Git에 커밋하지 않습니다.
