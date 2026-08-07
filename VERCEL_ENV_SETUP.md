# Vercel 환경변수 설정 매뉴얼

이 문서는 ON:GIL 프론트엔드와 Vercel Serverless Function이 사용하는 환경변수를 Vercel에 설정하는 방법을 설명합니다.

## 1. 필요한 환경변수

현재 프로젝트에 필요한 값은 총 3개입니다.

| 환경변수 | 값 | 사용 위치 | 브라우저 노출 | 필수 |
|---|---|---|---|---|
| `TOUR_API_SERVICE_KEY` | 공공데이터포털의 한국관광공사 일반 인증키(Decoding) | `/api/tourism` 서버리스 함수 | 노출되지 않음 | 필수 |
| `VITE_VWORLD_API_KEY` | 배포 URL로 발급한 VWorld 인증키 | VWorld 2D 지도·WFS 호출 | 노출됨 | 필수 |
| `VITE_VWORLD_DOMAIN` | VWorld에 등록한 Vercel 서비스 주소 | VWorld 도메인 검증 | 공개값 | 필수 |

현재 운영 주소가 아래 주소라면 `VITE_VWORLD_DOMAIN` 값은 다음과 같이 입력합니다.

```text
https://ongil-travel-dashboard.vercel.app
```

주소 끝의 `/`는 제외하는 것을 권장합니다. 실제 Production 주소가 다르면 반드시 실제 주소로 교체합니다.

현재 코드에서는 이 세 변수 외에 OpenAI 키, 데이터베이스 키 또는 별도의 Vercel 토큰을 요구하지 않습니다.

## 2. 키 준비

### 한국관광공사 TourAPI

공공데이터포털에서 `한국관광공사_국문 관광정보 서비스_GW` 활용신청 후 다음 값을 복사합니다.

```text
일반 인증키(Decoding)
```

Encoding 키가 아니라 **Decoding 키**를 사용합니다.

### VWorld

VWorld 인증키의 활용 API에는 다음 항목이 포함되어 있어야 합니다.

```text
2D 지도 API
WMS/WFS API
```

인증키 발급 URL에는 실제 Vercel Production 주소를 등록합니다.

```text
https://ongil-travel-dashboard.vercel.app
```

나중에 사용자 지정 도메인으로 변경하면 새 도메인으로 VWorld 키를 재발급하고 Vercel 환경변수도 함께 변경합니다.

## 3. Vercel 대시보드에서 등록

1. [Vercel Dashboard](https://vercel.com/dashboard)에 로그인합니다.
2. ON:GIL 프로젝트를 선택합니다.
3. 상단의 **Settings**를 엽니다.
4. 왼쪽 메뉴에서 **Environment Variables**를 선택합니다.
5. 아래 변수를 하나씩 추가합니다.

### 변수 1: TourAPI 서버 키

```text
Name: TOUR_API_SERVICE_KEY
Value: 공공데이터포털 일반 인증키(Decoding)
Environment: Production
```

Preview에서도 관광 API를 시험하려면 `Preview`도 선택합니다. 이 키는 서버에서만 사용되므로 Vercel의 Sensitive 옵션을 사용할 수 있습니다.

### 변수 2: VWorld 브라우저 키

```text
Name: VITE_VWORLD_API_KEY
Value: VWorld에서 발급받은 인증키
Environment: Production
```

`VITE_` 변수는 Vite 빌드 과정에서 브라우저 코드에 포함됩니다. Vercel에서 Sensitive로 표시하더라도 최종 브라우저에서는 확인할 수 있으므로, 보안은 VWorld에 등록한 도메인 제한에 의존합니다.

### 변수 3: VWorld 등록 도메인

```text
Name: VITE_VWORLD_DOMAIN
Value: https://ongil-travel-dashboard.vercel.app
Environment: Production
```

키 발급 시 VWorld에 입력한 URL과 동일하게 설정합니다. 프로토콜(`https://`)과 호스트 이름이 일치해야 합니다.

## 4. Production과 Preview 설정

Vercel의 Preview 배포 URL은 브랜치 또는 배포마다 Production URL과 달라질 수 있습니다. Production 도메인으로 발급한 VWorld 키는 Preview URL에서 거부될 수 있습니다.

권장 설정은 다음과 같습니다.

| 환경 | TourAPI | VWorld | 동작 |
|---|---|---|---|
| Production | 운영 키 등록 | Production URL용 키 등록 | 전체 API 사용 |
| Preview | 동일 TourAPI 키 또는 별도 키 | 미등록 | VWorld 실패 시 정적 지도 사용 |
| Development | 로컬 `.env.local` 사용 | localhost용 키가 있을 때만 등록 | 로컬 개발 |

Preview에서도 VWorld를 확인해야 한다면 안정적으로 유지되는 Preview/브랜치 도메인을 준비하고, 그 주소로 별도 VWorld 인증키를 발급한 뒤 Preview 환경에 다른 값을 등록합니다.

## 5. 저장 후 재배포

환경변수 변경은 이미 완료된 배포에 자동 반영되지 않습니다.

1. Vercel 프로젝트의 **Deployments** 탭으로 이동합니다.
2. 최신 Production 배포의 메뉴를 엽니다.
3. **Redeploy**를 선택합니다.
4. 배포 완료 후 Production 주소를 다시 엽니다.

`VITE_` 변수는 빌드 시점에 코드에 삽입되므로 환경변수를 바꾼 뒤에는 반드시 새로운 빌드가 필요합니다.

## 6. 배포 확인

### TourAPI 확인

브라우저에서 다음 주소를 엽니다.

```text
https://ongil-travel-dashboard.vercel.app/api/tourism?endpoint=areaCode2&numOfRows=1&pageNo=1
```

정상이면 JSON 응답에 다음 값이 포함됩니다.

```json
{
  "response": {
    "header": {
      "resultCode": "0000"
    }
  }
}
```

### VWorld 확인

다음 페이지를 엽니다.

```text
https://ongil-travel-dashboard.vercel.app/dashboard/gwangju/analytics
```

지도 왼쪽 상단 상태가 다음과 같이 표시되면 정상입니다.

```text
VWorld WFS 실시간 경계
```

등록 URL 또는 인증키가 맞지 않으면 기존 2025 정적 지도가 표시되고 URL 확인 안내가 나타납니다.

## 7. 오류별 확인 방법

### `TOUR_API_SERVICE_KEY 환경변수가 설정되지 않았습니다.`

- 변수 이름의 철자와 대소문자를 확인합니다.
- `Production` 환경에 체크되어 있는지 확인합니다.
- 저장 후 새로 배포했는지 확인합니다.

### TourAPI `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`

- 공공데이터포털의 Encoding 키가 아니라 Decoding 키인지 확인합니다.
- 해당 TourAPI 활용신청이 승인 또는 사용 가능 상태인지 확인합니다.

### VWorld `INCORRECT_KEY`

- VWorld에 등록한 URL과 `VITE_VWORLD_DOMAIN`을 비교합니다.
- Production URL로 발급한 키인지 확인합니다.
- 커스텀 도메인을 추가했다면 해당 도메인으로 키를 재발급합니다.

### `브라우저 요청이 차단됐습니다.`

- 접속 중인 주소와 VWorld 등록 URL이 다른 경우가 가장 흔합니다.
- Preview URL에서 Production용 키를 사용하고 있지 않은지 확인합니다.
- 환경변수를 변경한 뒤 재배포했는지 확인합니다.

### API 주소에서 앱 HTML이 표시되는 경우

- Vercel 배포에 `api/tourism.ts` 함수가 포함되었는지 확인합니다.
- Vercel 배포 상세 화면의 Functions 목록에서 `/api/tourism`을 확인합니다.
- SPA rewrite 설정이 `/api` 요청보다 먼저 적용되는지 배포 로그를 확인합니다.

## 8. 로컬 파일과 Git 관리

실제 키는 `.env.example`에 넣지 않습니다. 로컬 개발에서는 프로젝트 루트의 `.env.local`을 사용합니다.

```env
TOUR_API_SERVICE_KEY=실제_한국관광공사_Decoding_키
VITE_VWORLD_API_KEY=실제_VWorld_키
VITE_VWORLD_DOMAIN=http://127.0.0.1:5173
```

단, 마지막 주소는 VWorld에 localhost로 등록한 키가 있을 때만 동작합니다. `.env.local`은 현재 `.gitignore`에 포함되어 Git에 커밋되지 않습니다.

환경변수를 수정한 뒤에는 로컬 개발 서버도 다시 시작합니다.

```bash
npm run dev
```

## 공식 참고자료

- [Vercel 환경변수](https://vercel.com/docs/environment-variables)
- [Vercel 환경별 변수 관리](https://vercel.com/docs/environment-variables/manage-across-environments)
- [Vite 환경변수와 모드](https://vite.dev/guide/env-and-mode)

