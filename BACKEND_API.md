# 광주 관광 대시보드 백엔드 인수 문서

기존 Vite + Vercel 구조에서 `api/district/[resource].ts` 한 함수로 8개 리소스를 제공한다. 개발 서버도 `server/districtHttp.ts`의 동일 핸들러를 사용한다. 기존 관광 이미지·행정동 경계 프록시는 유지했다. 프런트 화면의 샘플 데이터 교체는 별도 프런트 작업이다.

## 실행과 검증

Node.js 22 이상 권장. 런타임 추가 패키지 없이 Node 내장 fetch·crypto·AsyncLocalStorage를 사용한다.

```powershell
npm test
npm run build
npm run dev
```

환경 변수는 `.env.example` 참고. `TOUR_API_SERVICE_KEY`는 서버 전용이며 `VITE_` 접두사를 사용하지 않는다. `.env.local`에 설정하거나 프로세스 환경으로 전달한다. 인증키 원본은 복사·수정하지 않았다. 공유 폴더에 실제 키를 저장하면 동기화된다는 점을 고려해 프로세스 환경 사용을 권장한다.

```text
TOUR_API_INDEX_BASE_YM=202608
TOUR_API_VISITOR_BASE_YM=202607
```

이 날짜는 제공 문서와 2026-09-17 실호출에서 확인한 스냅샷 설정이다. **최신월 자동 탐지가 아니다.** 새로운 완월 데이터 확인 후 갱신한다. 방문자 현재월·전월의 일별 3종 데이터가 모두 있을 때만 `momPct`를 계산한다.

실데이터 HTTP 스모크 검증은 로컬 서버를 시작하고 종료한다. 공공데이터 API 호출량을 소비한다. 기본 실행은 방문자 2개월과 전년 동월, `--full-history`는 12개월과 전년 동월을 검증한다.

```powershell
node scripts/smoke-district.mjs --key-file 'C:/Users/subin/OneDrive/바탕 화면/env.txt'
node scripts/smoke-district.mjs --key-file 'C:/Users/subin/OneDrive/바탕 화면/env.txt' --full-history
```

키 파일은 메모리에서만 읽으며 로그·파일·브라우저 번들에 넣지 않는다. 이미 `TOUR_API_SERVICE_KEY`가 설정되어 있으면 `--key-file`을 생략한다.

## API 계약

공유 타입: `src/types/district.ts`. 모든 성공 응답에 `baseYm`, `source: "출처: ⓒ한국관광공사"`, `fetchedAt`, `warnings`가 있다. `fetchedAt`은 응답 조합에 사용한 캐시 중 가장 오래된 수집 시각이다. 오류의 `fetchedAt`은 오류 응답 생성 시각이고 `baseYm`은 검증 전이면 null이다.

`district`: `donggu`, `seogu`, `namgu`, `bukgu`, `gwangsangu`. 생략 시 동구. `all`은 summary 전용이며 구별 `items`를 반환한다. 5개 구의 값을 광주 순방문자 수로 합산하지 않는다.

| GET 경로 | 파라미터 | 핵심 응답 | 최대 캐시 |
|---|---|---|---|
| `/api/district/summary` | district, baseYm?, visitorYm? | visitors, stay, spend, demand, age | 6시간 |
| `/api/district/visitors` | district, baseYm?, months=1~12 | series, previousYear | 24시간 |
| `/api/district/indices` | district, baseYm? | groups: 7그룹 49개 코드→숫자/null | 24시간 |
| `/api/district/contents` | district, contentTypeId? | items, typeShare, totalCount | 1시간 |
| `/api/district/festivals` | district, from=YYYYMMDD? | items, from | 1시간 |
| `/api/district/related` | district, baseYm? | hubs, top3Share, categoryMix | 24시간 |
| `/api/district/rank` | district, metric=21?, baseYm? | rank, total, percentile, topPct, complete | 24시간 |
| `/api/district/diagnosis` | district, baseYm?, visitorYm? | issues, priorities, radar, activationIndex, model | 6시간 |

`baseYm` 기본은 지수 설정월이며 visitors만 방문자 설정월이다. 과거 summary·diagnosis 요청의 기본 visitorYm은 baseYm과 방문자 설정월 중 이른 월이다. 명시적으로 서로 다른 월을 요청할 수도 있으므로 방문자에는 `visitors.month`를 표시한다. 범위는 201901~설정된 확인월이며 과거 데이터가 없으면 null/불완전 상태다. from 기본은 요청 시점 한국시간의 이번 달 1일. contentTypeId 허용값은 12·14·15·25·28·32·38·39.

```typescript
import type { SummaryResponse } from './src/types/district'

const response = await fetch('/api/district/summary?district=donggu')
if (!response.ok) {
  // 502·503만 별도 샘플 폴백 대상으로 처리하고 샘플 배지를 표시한다.
  // 400·404·405·500은 요청/구현 오류로 표시한다.
  throw new Error(`관광 API 오류: ${response.status}`)
}
const summary: SummaryResponse = await response.json()
// 방문자 기준월: summary.visitors.month
// 체류·소비 기준월: summary.baseYm, 단위: 지수
```

## 데이터 해석

- **방문자**: `metric/visitorsMetric=sum_of_daily_estimated_visitors`. touDivCd 1 현지인·2 외지인·3 외국인의 일별 추정치를 합산한다. 월간 고유 인원이나 관광객 개인 수가 아니다. 하루라도 구분값이 누락되면 `complete=false`와 함께 total/local/outside/foreign을 모두 null로 반환한다. 부분합을 월합으로 표시하지 않는다. `observedDays`, `expectedDays`, `through`도 함께 전달한다.
- **지수**: 시간·원·명·비율이 아니다. 숙박 비중 지수도 실제 숙박 비율(%)로 표시하면 안 된다. 출처에서 없거나 숫자로 변환할 수 없는 값은 null이다. [한국관광공사 공식 관광 다양성 설명](https://www.data.go.kr/data/15151365/openapi.do)도 수요 활성화를 평가하는 지수임을 명시한다.
- **2030 전월 대비**: 3102·3103 두 지수 합계의 전월 대비 증감률이다. 실제 2030 방문 인원 변화율로 이름 붙이지 않는다.
- **콘텐츠**: `typeShare`는 반환된 전체 콘텐츠의 대분류 건수 구성비다. 콘텐츠 유형 필터가 있으면 필터 결과가 분모다. 페이지 전체를 읽고 contentId 중복을 제거한다. 좌표 없는 항목은 lng/lat=null. 이미지 이용조건 검토를 위해 copyrightType을 전달한다. `temporalBasis=fetchedAt`으로 현재 목록임을 표시한다. baseYm은 공통 계약의 설정월이며 역사적 콘텐츠 스냅샷이 아니다.
- **축제**: from 이후 시작하는 축제를 조회한다. 이미 시작한 행사까지 포함하는 '현재 진행 중' 검색과 다르다. 장소는 목록 API의 주소이며 상세 행사장명을 추정하지 않는다. `temporalBasis=event_dates`를 확인한다.
- **연관관광지**: 기준 관광지→연관 관광지의 고유 연결 건수를 집계한다. top3Share는 연결 건수 상위 3개 허브의 비중이며 혼잡도·방문객 집중률이 아니다. 빈 응답은 null이다.
- **순위**: 지정 지수의 전국 시군구 관측값 내림차순이다. 시도 합계 행(signguCd=0) 제외, 동점 공동순위. percentile은 1위=100, 마지막=0으로 환산하고 topPct는 rank/total×100이다. complete는 각 시도·대상 구의 관측값과 반환된 시군구 행의 값 누락을 검사한다. 누락 시군구/시도는 missingDistricts/missingAreas에 담고 순위는 null로 반환한다. 원문에서 행 자체가 빠진 경우는 별도 행정구역 모집단이 없어 탐지하지 못한다. 이를 `scope=observed_nationwide_districts`, `populationVerified=false`로 표시한다. 화면도 '전국 관측 시군구 내 순위'로 표기한다.

## 코드 전환과 호출 보호

`server/regionCodes.ts`에서 구코드를 한 곳에서 관리한다.

| 구 | 현재 통계 | 과거 통계 | 콘텐츠 |
|---|---|---|---|
| 동구 | 12210 | 29110 | 12 / 210 |
| 서구 | 12240 | 29140 | 12 / 240 |
| 남구 | 12270 | 29155 | 12 / 270 |
| 북구 | 12300 | 29170 | 12 / 300 |
| 광산구 | 12330 | 29200 | 12 / 330 |

일반 통계는 202607부터 현재 코드, 자원 수요 서비스는 202608부터 현재 코드. 전국 시도도 해당 전환월 전후 17/16개를 조회한다.

서버 호출은 고정 HTTPS 호스트와 서비스/오퍼레이션·파라미터 허용 목록을 사용한다. 클라이언트가 serviceKey·호스트·페이지 크기를 지정할 수 없다. 리디렉션을 차단하고 호출당 12초, 전체 요청 25초, 요청당 최대 80회 실제 외부 호출, 최대 동시 호출 6개를 둔다. 대기 중 요청도 시간 한도가 지나면 취소한다. JSON 봉투 및 XML 오류를 변환하며 원문 오류·키·스택을 응답하지 않는다.

방문자 월 요청은 최대 30,000행을 요청하고 실제 totalCount와 받은 행 수를 검증해 다음 페이지를 읽는다. 월별 전국 원문은 캐시에 저장하지 않고 5개 구 집계만 보관한다. 다른 API도 전체 페이지를 수집하고 불완전 수집은 502로 실패한다. 12개월+전년 동월의 정상 cold 조회는 월별 24콜이며 공급자 페이지 제한이 달라지면 추가 호출이 발생한다.

프로세스 메모리 캐시와 진행 중 요청 합치기를 사용한다. 조합 캐시는 원본의 가장 이른 만료 시각을 상속하며 CDN `s-maxage`에도 남은 수명만 전달한다. 실패 응답은 `no-store`, 오류 Promise도 캐시하지 않는다. 각 클라이언트 인스턴스·오퍼레이션마다 UTC 일 900회 호출 방어 한도를 적용한다. 프로세스 재시작/다중 Vercel 인스턴스 간 전역 호출 예산을 보장하지는 않는다. 공개 운영 시 Vercel 측 트래픽 제한과 공급자 한도 모니터링을 별도 설정해야 한다.

실제 확인상 지표 코드 필터 생략은 전체 지수가 아니라 0건을 반환한다. 따라서 전체 indices는 49회가 필요하다. 진단은 필요한 9개 지수만 선택하고 summary와 겹치는 호출을 합쳐 cold 요청 최대 19회로 줄였다(추가 페이지 없는 정상 응답 기준). 전국 순위는 별도 rank API로 요청한다. 진단 로딩 때 전체 49개 지수와 전국 16개 지역을 강제로 다시 조회하지 않는다.

오류 계약: 400 입력 오류, 404 없는 리소스, 405 메서드 오류, 502 공급자 장애/수집 오류, 503 키 누락·설정 오류·요청 과부하, 500 내부 오류. 공사 오류 코드가 안전한 형식이면 `resultCode`를 함께 반환한다.

## 자체 진단 draft-1

문서의 미결정 사항을 공식 정책으로 확정하지 않았다. 구현은 `server/diagnosis.ts`의 버전이 있는 검토용 기본안이며 응답에 `model.status=provisional`을 명시한다.

| 문제 | 검토 신호 |
|---|---|
| 2030 방문 지수 변화 | 전월 대비 -5% 미만 |
| 숙박 비중 지수 | 80 미만 |
| 상위 3개 연관 관광지 비중 | 60% 초과 |
| 관광소비강도 지수 | 80 미만 |

레이더 6축: 운송업 소비 1109, 문화자연자원 수요 12, 소비 22, 체류 21, SNS 여행유형 1101~1104의 평균, 국제적 다양성 33. 자체 활성화 값은 이 6축 단순평균이며 공식 활성화 지수·효과 예측이 아니다. 어느 축이라도 누락되면 활성화 값은 null. 문제는 4개, 레이더는 6개를 유지하고 우선과제는 attention 항목만 문서상 문제 순서대로 최대 3개다. 정상 또는 데이터 부족인 항목으로 빈자리를 채우지 않는다. 야간·재방문 지표를 생성하지 않는다.

## 검증 및 남은 경계

2026-09-17 실제 로컬 HTTP 검증: 8개 리소스 200, 동구 콘텐츠 124건·9월 이후 축제 4건·49개 지수 누락 없음, 체류지수 72.15, 전국 관측 시군구 256개 중 체류지수 137위. 5개 구의 202607 방문자 자료는 각 31일×3구분 완전성이 확인됐다. 동구 202508~202607의 12개월 및 전년 동월 12개월도 모두 완전한 일별 자료를 확인했다. 숫자는 수집 시점의 확인 결과이며 고정 샘플로 구현하지 않았다. 소스·테스트·컴파일 산출물·프런트 번들에서 제공된 키 값의 노출은 0건이었다.

Vercel 배포, 배포 환경변수 등록, 운영 호출 한도 변경은 수행하지 않았다. 분담안에서 제외된 DB·스케줄러·백필 저장소·유사 지자체 사례 DB도 추가하지 않았다. 이 폴더에는 .git 메타데이터가 없어 커밋·브랜치 작업을 하지 않았다. 프런트 연결 및 자체 산식의 최종 제품 표기는 팀 인수 후 결정한다.
