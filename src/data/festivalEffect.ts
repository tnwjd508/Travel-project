// Display helpers only. Versioned analysis comes from the database API.
export interface EffectStat { n: number; meanPct: number; medianPct: number; ci95Pct: number[]; sharePositive: number }
export type EvidenceStatus = 'available' | 'insufficient_evidence' | 'unsupported_policy' | 'out_of_scope' | 'not_imported'

export const evidenceStatusLabels: Record<EvidenceStatus, string> = {
  out_of_scope: '지역 근거 없음',
  not_imported: '분석 자료 미등록',
  available: '과거 사례 참고',
  insufficient_evidence: '근거 부족',
  unsupported_policy: '정책 근거 없음',
}

export const evidenceStatusClass: Record<EvidenceStatus, string> = {
  out_of_scope: 'border-slate-200 bg-slate-50 text-slate-600',
  not_imported: 'border-slate-200 bg-slate-50 text-slate-600',
  available: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  insufficient_evidence: 'border-amber-200 bg-amber-50 text-amber-700',
  unsupported_policy: 'border-slate-200 bg-slate-50 text-slate-600',
}

export const formatPct = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
export const formatRange = (stat: EffectStat) => `${formatPct(stat.ci95Pct[0])} ~ ${formatPct(stat.ci95Pct[1])}`
