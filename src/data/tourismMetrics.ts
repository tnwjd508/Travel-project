export const INDEX_SOURCE_URL = 'https://datalab.visitkorea.or.kr/datalab/portal/loc/getTourActivateForm.do'
export const INDEX_BASIS = '한국관광공사가 월별 지역 데이터를 지수화한 값입니다. 같은 기준월·같은 지표의 다른 시군구와 비교해 읽습니다. 최솟값·최댓값은 매월 달라지며, 0~100점으로 고정되지 않습니다.'
export const INDEX_LIMIT = '100점 만점이나 전국 평균 100을 뜻하지 않습니다. 원래의 인원·금액·시간·비율로 환산할 수 없고, 월간 지수 변화만으로 실제 방문객이나 소비액의 증감을 단정할 수 없습니다.'

export const metricDefinitions = {
  age: { label: '연령별 방문 지수', description: '관광객 다양성의 10대~70대 이상 방문 관련 세부지표입니다. 각 막대는 해당 연령층의 지수이며, 막대를 합해도 전체 방문자 수나 100%가 되지 않습니다. 예를 들어 20대 지수 72는 방문자 72명 또는 20대 비중 72%라는 뜻이 아닙니다.' },
  stay: { label: '관광체류강도', description: '지역의 관광 체류 관련 세부지표를 종합한 지수입니다. 평균 체류시간이나 숙박 일수를 직접 나타내지 않습니다.' },
  lodging: { label: '숙박 비중 지수', description: '숙박 비중에 관한 세부지표를 지수로 표현한 값입니다. 58이라는 값이 숙박객 비율 58%를 의미하지 않습니다.' },
  spend: { label: '관광소비강도', description: '지역의 관광 소비 관련 세부지표를 종합한 지수입니다. 실제 카드 결제액이나 1인당 소비 금액과 구분해 읽습니다.' },
  demand: { label: '관광서비스수요', description: '여행 유형별 SNS 언급, 업종별 관광 소비, 내비게이션 목적지 검색 관련 하위 지표의 평균입니다.' },
  culture: { label: '문화자연자원 수요', description: '문화·자연자원 목적지의 내비게이션 검색 관련 하위 지표의 평균입니다. 관광지 개수나 실제 입장객 수가 아닙니다.' },
  diversity: { label: '관광객 다양성', description: '연령대별 방문 관련 하위 지표를 종합한 값입니다. 연령대별 실제 인원이나 구성 비율은 이 지수만으로 알 수 없습니다.' },
  spendDiversity: { label: '관광소비 다양성', description: '관광 소비의 다양성 관련 하위 지표를 종합한 값입니다. 실제 소비액이나 소비 구성비와는 단위가 다릅니다.' },
  international: { label: '국제적 다양성', description: '지역 관광의 국제적 다양성 관련 하위 지표를 종합한 값입니다. 외국인 수 또는 외국인 비중을 직접 나타내지 않습니다.' },
  access: { label: '운송업 소비 지수', description: '관광서비스수요의 운송업 소비 관련 세부지표입니다. 교통 접근성 점수나 이동시간을 직접 측정한 값이 아닙니다.' },
  awareness: { label: 'SNS 여행유형 언급 지수 평균', description: '이 서비스가 관광서비스수요의 SNS 여행유형 4개 지수를 더해 4로 나눈 값입니다. SNS 게시물 수나 인지도 설문 점수가 아닙니다.' },
} satisfies Record<string, { label: string; description: string }>
export type MetricKey = keyof typeof metricDefinitions
export const radarMetrics: MetricKey[] = ['access', 'culture', 'spend', 'stay', 'awareness', 'international']
export const briefingMetrics: MetricKey[] = ['demand', 'culture', 'stay', 'spend', 'diversity', 'spendDiversity', 'international']

// backend/diagnosis.py 및 server/diagnosis.ts의 draft-1 규칙 설명. 공인 판정 기준이 아님.
export const diagnosisCriteria: Record<string, string> = {
  youth: '20대·30대 지수 합계의 전월 대비 변화율 = (당월 합계 − 전월 합계) ÷ 전월 합계 × 100. −5% 미만이면 검토 대상입니다.',
  stay: '숙박 비중 지수가 80 미만이면 검토 대상입니다. 서비스의 임시 점검 기준입니다.',
  concentration: '상위 3개 허브의 연관 건수 ÷ 전체 허브 연관 건수 × 100. 60% 초과이면 검토 대상입니다.',
  spend: '관광소비강도 지수가 80 미만이면 검토 대상입니다. 서비스의 임시 점검 기준입니다.',
}
export const issueStatusLabels = { attention: '검토 필요', normal: '검토 기준 미해당', unknown: '자료 부족' } as const
export const ACTIVATION_BASIS = '자체 활성화 지수 = 아래 6축 지수의 합 ÷ 6 (동일 가중치, 소수 둘째 자리 반올림). 한 축이라도 없으면 산출하지 않습니다. 한국관광공사의 8개 지표 평균인 관광수요 지수와는 별도의 검토용 산식이며, 100점 만점이 아닙니다.'

export function metricMonth(value: string) {
  const compact = value.replace('-', '')
  return `${compact.slice(0, 4)}년 ${Number(compact.slice(4, 6))}월`
}
