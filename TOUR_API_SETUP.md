# 한국관광공사 TourAPI 인증키 설정

현재 인증키는 FastAPI 서버에만 설정한다. React는 `/api/tourism` 또는 `/api/district/*`를 호출하며, Vite/Vercel이 FastAPI에 전달한다.

1. 공공데이터포털에서 필요한 한국관광공사 관광 콘텐츠·데이터랩·지수 API의 활용신청을 확인한다.
2. 일반 인증키(Decoding)를 서버 환경변수 `TOUR_API_SERVICE_KEY`에 설정한다. 인코딩 키도 서버에서 한 번 디코딩한다.
3. 파일 사용 시 `npm run dev -- --key-file <파일경로>`로 실행한다. 파일 형식은 `인증키 : 값` 또는 `TOUR_API_SERVICE_KEY=값`이다. 원본 파일은 수정·복사하지 않는다.
4. `.env.local` 사용 시 `.env.example`을 복사해 값을 채운 후 `npm run dev`로 실행한다. 이 프로젝트는 공유 폴더이므로 실제 키를 저장하는 대신 외부 키 파일 또는 프로세스 환경 사용을 권장한다.
5. 실행 중 키를 바꾸면 FastAPI를 재시작한다.

Python 가상환경 설치가 먼저 필요하다. 설치 명령은 [FASTAPI_REACT.md](FASTAPI_REACT.md)에 있다. 인증키·프록시 토큰에 `VITE_` 접두사를 붙이지 않는다. `.env.local`과 `.venv`는 Git에서 제외한다.

연결 확인:

```text
http://127.0.0.1:8000/api/health
http://127.0.0.1:8000/api/district/summary?district=donggu
```

`tourApiConfigured`는 키 존재 여부만 의미하며 활용승인이나 키 유효성을 검증하지 않는다. summary가 200이고 source/fetchedAt 및 지표를 반환하는지 확인한다. 503 MISSING_KEY는 서버 키 설정, 502 UPSTREAM_ERROR는 API 활용승인/쿼터/서비스 응답을 확인한다. 원본 외부 응답이나 키는 오류 메시지에 포함하지 않는다.

Vercel 분리 배포 설정은 [VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md)를 참고한다.
