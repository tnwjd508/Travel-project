# 축제 개최 효과 분석

정책 시뮬레이션의 **문화축제** 근거 수치를 만드는 스크립트입니다. 결과는
`src/assets/data/festival-effect.json`에 저장되고, 시뮬레이션·전략 비교 화면이 이 파일을 읽습니다.

## 무엇을 재나
축제 기간 동안 개최 시군구의 **외지인 방문(일별 추정치)** 이 평소보다 얼마나 달랐는지.

- 평소: 같은 시군구의 2~4주 전 같은 요일 평균
- 공통 요인 제거: 같은 시도에서 그 기간 축제가 없던 시군구의 변화를 뺌(이중차분)
- 위약 검정: 축제가 없는 무작위 날짜로 같은 계산 → 0 근처여야 정상
- 1~7일 축제만 사용, 95% 구간은 부트스트랩 2,000회

**다루지 않는 것**: 관광 소비, 체류시간, 재방문, 예산 규모별 효과. 결과는 과거 사례의 평균이며 특정 축제의 효과를 보장하지 않습니다.

## 데이터
| 자료 | 출처 | 비고 |
|---|---|---|
| 일별 방문자 | 한국관광공사 DataLab `locgoRegnVisitrDDList` | 2018-01부터, 약 1개월 늦게 갱신 |
| 행사 | 한국관광공사 `KorService2/searchFestival2` | 축제별 최신 회차만(2022-11 이후) |
| 행사(보완) | 공공데이터포털 전국문화축제표준데이터 CSV | 직접 내려받아 경로 지정 |

광주(29)·전남(46) 시군구는 2026-07부터 통합 코드 12로 바뀌어, 이름으로 이어 붙입니다.

## 실행
`.env`에 `TOUR_API_SERVICE_KEY`가 있어야 합니다. 원본 데이터는 `scripts/festival-effect/data/`(git 제외)에 저장됩니다.

```powershell
$py = "backend/.venv/Scripts/python.exe"   # 또는 .venv/Scripts/python.exe
& $py scripts/festival-effect/collect_visitors.py --to 202608   # 월 1회 호출, 처음엔 약 7분
& $py scripts/festival-effect/fetch_festivals.py
& $py scripts/festival-effect/merge_festivals.py --standard-csv "C:/경로/전국문화축제표준데이터.csv"
& $py scripts/festival-effect/analyze.py
& $py -m pytest scripts/festival-effect -q
```

개발계정 한도는 오퍼레이션별 하루 1,000회입니다. 방문자 전체 수집은 약 104회입니다.
