import type { DiagnosisResponse, IndicesResponse, RelatedResponse, SummaryResponse } from '../src/types/district.js'

export const DIAGNOSIS_MODEL = {
  version: 'draft-1', status: 'provisional' as const,
  description: '정책 검토용 자체 규칙입니다. 인과 추정·방문자 예측·공식 관광 활성화 지수가 아닙니다.',
}
const THRESHOLDS = { index: 80, youthChangePct: -5, relatedSharePct: 60 }
const mean = (values: (number | null)[]) => values.some(value => value === null) ? null : values.reduce<number>((sum, value) => sum + value!, 0) / values.length
export function diagnose(summary: SummaryResponse, indices: IndicesResponse, related: RelatedResponse): DiagnosisResponse {
  const inputs = [
    { id: 'youth', label: '2030 방문 지수 변화', value: summary.age.momPct, unit: 'percent' as const, attention: (v: number) => v < THRESHOLDS.youthChangePct, task: '2030 대상 콘텐츠와 유입 경로 검토' },
    { id: 'stay', label: '숙박 비중 지수', value: summary.stay.ix2102, unit: 'index' as const, attention: (v: number) => v < THRESHOLDS.index, task: '숙박 연계 관광 코스 검토' },
    { id: 'concentration', label: '상위 3개 관광지 연관 건수 비중', value: related.top3Share, unit: 'percent' as const, attention: (v: number) => v > THRESHOLDS.relatedSharePct, task: '연관 관광지 네트워크와 코스 다양화 검토' },
    { id: 'spend', label: '관광소비강도 지수', value: summary.spend.ix22, unit: 'index' as const, attention: (v: number) => v < THRESHOLDS.index, task: '관광·상권 소비 연결 프로그램 검토' },
  ]
  const issues: DiagnosisResponse['issues'] = inputs.map(input => ({ id: input.id, label: input.label, value: input.value, unit: input.unit,
    status: input.value === null ? 'unknown' : input.attention(input.value) ? 'attention' : 'normal',
    evidence: input.value === null ? `${input.label}: 데이터 부족` : `${input.label}: ${input.value.toFixed(2)}${input.unit === 'percent' ? '%' : ' (지수)'}; 기준월 ${summary.baseYm}` }))
  const priorities = issues.filter(issue => issue.status === 'attention').slice(0, 3).map(issue => ({ issueId: issue.id, title: inputs.find(input => input.id === issue.id)!.task, evidence: issue.evidence }))
  const g = indices.groups
  const radar = [
    { id: 'access', label: '운송업 소비 지수', value: g.demand['1109'] },
    { id: 'content', label: '문화자연자원 수요 지수', value: g.culture['12'] },
    { id: 'spend', label: '관광소비강도 지수', value: g.spend['22'] },
    { id: 'stay', label: '관광체류강도 지수', value: g.stay['21'] },
    { id: 'awareness', label: 'SNS 여행유형 언급 지수 평균', value: mean(['1101', '1102', '1103', '1104'].map(code => g.demand[code])) },
    { id: 'international', label: '국제적 다양성 지수', value: g.international['33'] },
  ]
  const activation = mean(radar.map(axis => axis.value))
  return { baseYm: summary.baseYm, fetchedAt: summary.fetchedAt, source: summary.source, district: summary.district,
    warnings: [...new Set([...summary.warnings, ...indices.warnings, ...related.warnings, '자체 산식 draft-1: 6축 단순평균. 팀 검토 필요. 연관 건수 비중은 방문객 집중률이 아닙니다.'])],
    model: DIAGNOSIS_MODEL, issues, priorities, radar, activationIndex: activation === null ? null : Math.round(activation * 100) / 100 }
}
