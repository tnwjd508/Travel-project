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
