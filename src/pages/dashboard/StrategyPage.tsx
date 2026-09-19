import { GitCompareArrows, Sparkles } from 'lucide-react'
import { DashboardPageFrame } from '@/components/dashboard/DashboardPageFrame'
import { ImpactTimeline } from '@/components/dashboard/ImpactTimeline'
import { StrategyTable } from '@/components/dashboard/StrategyTable'
import { policyLabels } from '@/data/policies'
import { useTourismStrategyStore } from '@/stores/useTourismStrategyStore'

export function StrategyPage() {
  const { simulationResult, selectedPolicy, budget, duration } = useTourismStrategyStore()
  return <DashboardPageFrame eyebrow="Strategy Compare" title="가장 현실적인 전략을 비교합니다" description="기대효과뿐 아니라 예산과 실행 난이도까지 균형 있게 평가했습니다." icon={GitCompareArrows}>
    {simulationResult && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-3 text-xs text-blue-800"><span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-white"><Sparkles size={15}/></span><b>현재 시뮬레이션</b><span>{policyLabels[selectedPolicy]} · {budget}억 원 · {duration}</span><span className="ml-auto rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-600">분석 결과 유지 중</span></div>}
    <div className="space-y-5"><StrategyTable/><ImpactTimeline/></div>
  </DashboardPageFrame>
}
