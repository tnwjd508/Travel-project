# Vercel + FastAPI 환경변수 설정

현재 기본 백엔드는 FastAPI다. Vercel은 React 정적 파일과 `/api/*` 전달 어댑터를 제공한다. 별도 FastAPI 서버 없이 Vercel만 배포하면 API는 `MISSING_BACKEND`로 응답한다.

| 위치 | 환경변수 | 설명 |
| --- | --- | --- |
| Vercel | `FASTAPI_BASE_URL` | 실제 FastAPI 서버의 HTTPS origin |
| Vercel과 FastAPI | `FASTAPI_PROXY_TOKEN` | 양쪽에 같은 충분히 긴 서버 전용 비밀값 |
| FastAPI | `TOUR_API_SERVICE_KEY` | 관광공사 인증키 |
| FastAPI | `TOUR_API_INDEX_BASE_YM` | 확인한 지수 기준월, 기본 202608 |
| FastAPI | `TOUR_API_VISITOR_BASE_YM` | 확인한 방문 기준월, 기본 202607 |
| FastAPI (선택) | `VWORLD_API_KEY`, `VWORLD_DOMAIN` | VWorld 인증키와 등록 도메인 |

Vercel Settings → Environment Variables에서 Production/Preview 등 해당 환경에 값을 설정하고 재배포한다. FastAPI도 환경변수 변경 후 재시작한다. 이 작업에서는 운영 배포나 외부 환경변수 변경을 수행하지 않았다.

`VITE_` 접두사는 인증키나 프록시 토큰에 사용하지 않는다. 과거 문서의 `VITE_VWORLD_API_KEY` 설정은 폐기한다. Vercel 어댑터는 서버에서만 토큰 헤더를 추가하고, FastAPI는 `/api/*`를 검증한다. `/api/health`는 인증 없이 상태만 반환한다. 프록시 토큰이 있는 origin에 브라우저가 직접 API를 요청하면 401이 정상이다.

브라우저에서 Vercel의 `/api/district/summary?district=donggu`를 조회해 정상 JSON 응답과 source/fetchedAt을 확인한다. 503 `MISSING_BACKEND`는 Vercel origin 설정, 401은 양쪽 토큰 불일치, 502 `BACKEND_UNAVAILABLE`은 연결/TLS/서버 상태를 확인한다. 관광공사 오류는 FastAPI에 설정된 키와 활용승인을 확인한다.

FastAPI 단독 운영에서는 빌드한 React를 FastAPI가 직접 제공하므로 Vercel이 필요 없다. 이때 `FASTAPI_PROXY_TOKEN`은 비워 두고 HTTPS/ingress 요청 제한을 구성한다. 자세한 명령과 운영 한계는 [FASTAPI_REACT.md](FASTAPI_REACT.md)를 참고한다.
