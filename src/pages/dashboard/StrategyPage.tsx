import { ClipboardList, GitCompareArrows } from 'lucide-react'
import { DashboardPageFrame } from '@/components/dashboard/DashboardPageFrame'
import { ImpactTimeline } from '@/components/dashboard/ImpactTimeline'
import { StrategyTable } from '@/components/dashboard/StrategyTable'
import { policyLabels } from '@/data/policies'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { useTourismStrategyStore } from '@/stores/useTourismStrategyStore'

export function StrategyPage() {
  const district = useActiveDistrict()
  const { simulationResult, selectedPolicy, duration } = useTourismStrategyStore()
  const scenario = simulationResult?.district === district.slug ? simulationResult : null
  return <DashboardPageFrame eyebrow="Strategy Compare" title="진단 결과와 연결해 전략을 비교합니다" description="각 정책이 겨냥하는 지표가 현재 진단에서 어떤 상태인지 나란히 확인합니다." icon={GitCompareArrows}>
    {scenario && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-3 text-xs text-blue-800"><span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-white"><ClipboardList size={15}/></span><b>현재 시나리오</b><span>{policyLabels[scenario.policy]} · {scenario.budget}억 원 · {scenario.duration}</span><span className="ml-auto rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-amber-700">효과 예측 모델 미연결</span></div>}
    <div className="space-y-5"><StrategyTable currentPolicy={scenario?.policy}/><ImpactTimeline policy={scenario?.policy ?? selectedPolicy} duration={scenario?.duration ?? duration}/></div>
  </DashboardPageFrame>
}
