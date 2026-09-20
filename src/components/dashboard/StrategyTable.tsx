import { BadgeCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { DataNotice, SourceNote } from '@/components/dashboard/DataNotice'
import { policyOptions, policyTargets, type PolicyId } from '@/data/policies'
import { issueStatusLabels } from '@/data/tourismMetrics'
import { evidenceStatusLabels, formatPct, formatRange } from '@/data/festivalEffect'
import type { PolicyEvidence } from '@/lib/evidenceClient'
import type { useMunicipalityData } from '@/hooks/useMunicipalityData'

export function StrategyTable({ currentPolicy, context }: { currentPolicy?: PolicyId; context: ReturnType<typeof useMunicipalityData> }) {
  const state = context.diagnosisState
  const issues = state.data?.issues ?? []
  // 진단에서 '검토 필요'로 나온 목표 지표가 많은 정책을 위에 둔다. 효과 크기 순위가 아니다.
  const rows = policyOptions.map((policy, order) => {
    const targets = policyTargets[policy.value].issueIds.map(id => ({ id, issue: issues.find(issue => issue.id === id) }))
    const attention = targets.filter(target => target.issue?.status === 'attention').length
    return { ...policy, order, targets, attention }
  }).sort((a, b) => b.attention - a.attention || a.order - b.order)

  return <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6 sm:px-7"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-blue-600">Strategy Compare</p><h3 className="mt-1 text-lg font-bold">진단 연관도로 본 정책 비교</h3></div><div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-600"><BadgeCheck size={14}/>규칙 기반 진단 결과 기준</div></div>
    {context.evidenceState.status === 'error' && <div className="p-6"><DataNotice state={context.evidenceState}/></div>}
    {state.status !== 'live' && <div className="p-6"><DataNotice state={state}/></div>}
    {state.data && <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400"><th className="px-7 py-4">정책</th><th className="px-4 py-4">겨냥 지표 · 현재 진단</th><th className="px-4 py-4">진단 연관</th><th className="px-7 py-4">과거 사례 변화</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.value} className={`border-b border-slate-50 text-sm last:border-0 ${row.value === currentPolicy ? 'bg-blue-50/60' : ''}`}><td className="px-7 py-4"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500">{index + 1}</span><div><p className="font-bold text-slate-800">{row.label}</p>{row.value === currentPolicy && <p className="mt-0.5 text-[10px] text-blue-600">현재 검토 중인 시나리오</p>}</div></div></td><td className="px-4 py-4"><div className="flex flex-wrap gap-1.5">{row.targets.map(target => <span key={target.id} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${target.issue?.status === 'attention' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{target.issue?.label ?? target.id} · {issueStatusLabels[target.issue?.status ?? 'unknown']}</span>)}</div></td><td className="px-4 py-4 text-xs font-semibold text-slate-700">{row.targets.length}개 중 {row.attention}개 검토 필요</td><td className="px-7 py-4 text-xs"><EffectCell evidence={context.evidence(row.value)}/></td></tr>)}</tbody></table></div>}
    <div className="border-t border-slate-100 px-7 py-4 text-[11px] leading-5 text-slate-500"><p>순서는 정책이 겨냥하는 지표 중 현재 '검토 필요'로 진단된 지표 수입니다. 정책 효과의 크기나 예산 대비 효율을 뜻하지 않으며, 정책–지표 연결은 기획 단계의 가정입니다.</p><p className="mt-1">과거 사례 변화는 과거 전국 축제 사례의 축제 기간 외지인 방문 변화(95% 구간)입니다. 구간이 0을 포함하면 '근거 부족'으로 표시합니다.</p>{state.data && <SourceNote data={state.data}/>}</div>
  </Card>
}

function EffectCell({ evidence }: { evidence: PolicyEvidence | null }) {
  if (!evidence) return <span className="text-slate-400">조회 가능한 근거 없음</span>
  if (evidence.status === 'out_of_scope') return <span className="text-slate-400">지역 근거 없음</span>
  if (!evidence.stat) return <span className="text-slate-400">{evidenceStatusLabels[evidence.status]}</span>
  if (evidence.status !== 'available') return <span className="font-semibold text-amber-700">근거 부족<span className="block text-[10px] font-normal text-slate-500">{formatRange(evidence.stat)} · {evidence.stat.n}건</span></span>
  return <span className="font-bold text-emerald-700">외지인 {formatPct(evidence.stat.meanPct)}<span className="block text-[10px] font-normal text-slate-500">{formatRange(evidence.stat)} · {evidence.stat.n}건</span></span>
}
