// 지역현황·정책 시뮬레이션·보고서에서 같은 지표 이름과 설명을 사용합니다.
// 항목 이름이 소비액·비중이어도 API 반환 단위는 원·%가 아닌 지수입니다.
export type OverviewMetricKey = 'stay' | 'spend' | 'demand'
export interface IndicatorItem { code: string; label: string; description: string; caution: string }
export interface OverviewIndicator {
  key: OverviewMetricKey
  code: string
  label: string
  groups: { label: string; items: IndicatorItem[] }[]
}

const mobility = (code: string, label: string, description: string): IndicatorItem => ({
  code, label, description, caution: '표시값은 지수이며, 실제 비율(%)이나 방문자 수가 아닙니다.',
})
const spending = (code: string, label: string, description: string): IndicatorItem => ({
  code, label, description, caution: '표시값은 지수이며, 실제 소비 금액이나 1인당 지출액이 아닙니다.',
})

export const overviewIndicators: OverviewIndicator[] = [
  { key: 'stay', code: '21', label: '관광 체류 강도', groups: [{ label: '', items: [
    mobility('2101', '타권역 방문자 비중', '지역을 방문한 이동 인구 중 다른 지자체에서 찾아온 인구의 비중을 바탕으로 만든 지수입니다.'),
    mobility('2102', '숙박 비중', '지역을 방문한 이동 인구 중 숙박한 인구의 비중을 바탕으로 만든 지수입니다.'),
    mobility('2103', '1박 방문자', '지역의 숙박 방문자 중 1박을 한 방문자의 비중을 바탕으로 만든 지수입니다.'),
    mobility('2104', '2박 방문자', '지역의 숙박 방문자 중 2박을 한 방문자의 비중을 바탕으로 만든 지수입니다.'),
    mobility('2105', '3박 이상 방문자', '지역의 숙박 방문자 중 3박 이상 머문 방문자의 비중을 바탕으로 만든 지수입니다.'),
  ] }] },
  { key: 'spend', code: '22', label: '관광 소비 강도', groups: [{ label: '', items: [
    spending('2201', '외지인 소비액', '지역에서 발생한 신용카드 소비액 중 외지인이 지출한 금액의 합을 바탕으로 만든 지수입니다.'),
    mobility('2202', '전체 소비 대비 외지인 소비액 비중', '지역 전체 신용카드 소비액에서 외지인의 소비액이 차지하는 비중을 바탕으로 만든 지수입니다.'),
    spending('2203', '방문량 대비 소비액', '지역을 방문한 이동 인구 대비 소비 금액을 바탕으로 만든 지수입니다.'),
  ] }] },
  { key: 'demand', code: '11', label: '관광 서비스 수요', groups: [
    { label: 'SNS 언급', items: ['레포츠', '휴식·힐링', '미식', '체험'].map((label, index) => ({
      code: String(1101 + index), label,
      description: `이 지역의 관광 관련 SNS 언급 중 ${label} 여행 유형의 키워드가 언급된 양을 바탕으로 만든 지수입니다.`,
      caution: '표시값은 지수이며, 실제 SNS 언급 건수가 아닙니다.',
    })) },
    { label: '업종별 소비', items: ['쇼핑업', '식음료', '숙박업', '여가 서비스업', '운송업'].map((label, index) => ({
      code: String(1105 + index), label,
      description: `이 지역의 ${label} 업종에서 발생한 소비액을 바탕으로 만든 지수입니다.`,
      caution: '표시값은 지수이며, 실제 결제 금액이나 매출액이 아닙니다.',
    })) },
    { label: '내비게이션 목적지 검색', items: ['숙박', '음식', '쇼핑'].map((label, index) => ({
      code: String(1110 + index), label,
      description: `이 지역의 내비게이션 목적지 검색 중 ${label} 유형의 장소가 검색된 양을 바탕으로 만든 지수입니다.`,
      caution: '표시값은 지수이며, 실제 검색 건수나 방문자 수가 아닙니다.',
    })) },
  ] },
]
