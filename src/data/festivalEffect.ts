import festivalEffect from '@/assets/data/festival-effect.json'
import type { PolicyId } from '@/data/policies'

// scripts/festival-effect/analyze.py가 만든 요약. 수치를 코드에 적지 않고 이 파일에서만 읽는다.
export interface EffectStat { n: number; meanPct: number; medianPct: number; ci95Pct: number[]; sharePositive: number }

export type EvidenceStatus = 'evidence_based' | 'insufficient_evidence' | 'model_not_connected'

export interface PolicyEvidence {
  status: EvidenceStatus
  stat: EffectStat | null
  basis: string
}

const outside = festivalEffect.outside as Record<'all' | 'short' | 'long' | 'night' | 'metroGu' | 'placebo', EffectStat>

export const festivalEvidenceMeta = {
  outcome: festivalEffect.outcome,
  method: festivalEffect.method,
  visitorsFrom: festivalEffect.data.visitorsFrom,
  visitorsTo: festivalEffect.data.visitorsTo,
  festivalStart: festivalEffect.data.festivalStart,
  placebo: outside.placebo,
  sources: '한국관광공사 DataLab 방문자·행사정보, 공공데이터포털 전국문화축제표준데이터',
}

// 95% 구간 하한이 0보다 클 때만 효과가 있다고 표시한다.
const isSupported = (stat: EffectStat) => stat.ci95Pct[0] > 0

// 앱의 대상은 광주 자치구이므로 전국 광역시 자치구 축제 결과를 쓴다.
export function policyEvidence(policy: PolicyId): PolicyEvidence {
  if (policy === 'festival') {
    const stat = outside.metroGu
    return { status: isSupported(stat) ? 'evidence_based' : 'insufficient_evidence', stat, basis: `전국 광역시 자치구 축제 ${stat.n}건` }
  }
  if (policy === 'night') {
    const stat = outside.night
    return { status: isSupported(stat) ? 'evidence_based' : 'insufficient_evidence', stat, basis: `제목에 야간 키워드가 있는 축제 ${stat.n}건` }
  }
  return { status: 'model_not_connected', stat: null, basis: '과거 시행 기록 데이터 없음' }
}

export const evidenceStatusLabels: Record<EvidenceStatus, string> = {
  evidence_based: '과거 사례 기반 추정',
  insufficient_evidence: '근거 부족',
  model_not_connected: '효과 예측 모델 미연결',
}

export const evidenceStatusClass: Record<EvidenceStatus, string> = {
  evidence_based: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  insufficient_evidence: 'border-amber-200 bg-amber-50 text-amber-700',
  model_not_connected: 'border-slate-200 bg-slate-50 text-slate-600',
}

export const formatPct = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
export const formatRange = (stat: EffectStat) => `${formatPct(stat.ci95Pct[0])} ~ ${formatPct(stat.ci95Pct[1])}`
