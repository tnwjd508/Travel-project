# 시군구 선택 지도

- 원자료 제공: 통계청 통계지리정보서비스(SGIS)
- 원자료 수집일: 2018-12-24
- 공개 저장소: https://github.com/southkorea/southkorea-maps/tree/master/kostat/2018/json
- 이용 조건: 공공누리 제1유형(출처 표시), 원자료 라이선스 https://github.com/southkorea/southkorea-maps/blob/master/kostat/2018/json/LICENSE.md
- 가공: 시도별 파일 분리, 경계 단순화, 관광 지역 목록과 시도·이름으로 연결, 군위군 시도 이관 반영

이 지도는 지역 선택용 참고 경계이며 최신 행정구역 경계를 보증하지 않습니다. 현재 코드에 대응하지 않는 과거 경계와 경계가 없는 현재 시군구는 지도에서 선택할 수 없습니다. 별도의 시군구 목록은 표시하지 않습니다. 조회 데이터는 현재 관광 API 코드를 사용합니다. 기존 광주 지도는 별도 자산을 유지합니다.

재생성: 프로젝트 루트에서 `npm run sync:region-maps`를 실행합니다. 지도 자산에는 인증키가 포함되지 않습니다.
