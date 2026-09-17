# 한국관광공사 TourAPI 인증키 설정

ON:GIL은 인증키를 브라우저에 노출하지 않도록 `/api/tourism` 서버 프록시를 사용합니다.

## 로컬 설정

1. 공공데이터포털의 `한국관광공사_국문 관광정보 서비스_GW` 활용신청을 완료합니다.
2. 마이페이지에서 **일반 인증키(Decoding)** 를 복사합니다.
3. 프로젝트 루트의 `.env.local`에 다음처럼 입력합니다.

```env
TOUR_API_SERVICE_KEY=발급받은_디코딩_인증키
```

4. 이미 개발 서버가 실행 중이었다면 종료 후 다시 실행합니다.

```bash
npm run dev
```

5. 브라우저에서 아래 주소를 열어 연결을 확인합니다.

```text
http://localhost:5173/api/tourism?endpoint=areaCode2&numOfRows=1&pageNo=1
```

응답의 `resultCode`가 `0000`이면 정상입니다.

## Vercel 배포 설정

Vercel 프로젝트의 **Settings → Environment Variables**에서 다음 변수를 추가합니다.

- Name: `TOUR_API_SERVICE_KEY`
- Value: 공공데이터포털의 일반 인증키(Decoding)
- Environment: Production, Preview, Development

저장 후 재배포해야 적용됩니다. `.env.local`은 Git에 업로드되지 않습니다.

## 프런트엔드 사용 예시

```ts
import { getGwangjuTourismList } from '@/services/tourApi'

const result = await getGwangjuTourismList()
console.log(result.items)
```

인증키에 `VITE_` 접두사를 붙이거나 React 컴포넌트에서 직접 사용하지 마세요.
