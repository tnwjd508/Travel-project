export const policyOptions = [
  { value: 'night', label: '야간관광 확대' },
  { value: 'festival', label: '문화축제 개최' },
  { value: 'shuttle', label: '관광 셔틀 운영' },
  { value: 'market', label: '로컬마켓 연계' },
  { value: 'art', label: '문화예술 프로그램' },
] as const

export type PolicyId = (typeof policyOptions)[number]['value']
export type PolicyDuration = '3개월' | '6개월' | '1년'

export const policyLabels = Object.fromEntries(
  policyOptions.map((policy) => [policy.value, policy.label]),
) as Record<PolicyId, string>

// 정책이 개선을 겨냥하는 진단 지표(backend/diagnosis.py의 issue id).
// 기획 단계의 연결 가정이며, 효과 크기를 뜻하지 않는다.
export const policyTargets: Record<PolicyId, { issueIds: string[]; rationale: string }> = {
  night: { issueIds: ['stay', 'spend'], rationale: '저녁 시간대 콘텐츠로 숙박·체류와 야간 소비를 늘리는 것을 목표로 합니다.' },
  festival: { issueIds: ['youth', 'spend'], rationale: '행사 수요로 2030 방문과 행사 기간 소비를 끌어올리는 것을 목표로 합니다.' },
  shuttle: { issueIds: ['concentration'], rationale: '주요 거점 간 이동을 연결해 일부 관광지에 몰린 방문을 분산하는 것을 목표로 합니다.' },
  market: { issueIds: ['spend', 'concentration'], rationale: '관광지 방문을 주변 상권 소비로 잇고 방문 동선을 넓히는 것을 목표로 합니다.' },
  art: { issueIds: ['youth', 'stay'], rationale: '체험형 프로그램으로 2030 방문과 체류를 늘리는 것을 목표로 합니다.' },
}

export const policyDurationMonths: Record<PolicyDuration, number> = { '3개월': 3, '6개월': 6, '1년': 12 }
