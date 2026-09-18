import { FlaskConical } from 'lucide-react'
import { DashboardPageFrame } from '@/components/dashboard/DashboardPageFrame'
import { Simulation } from '@/components/dashboard/Simulation'
import { KpiGrid } from '@/components/dashboard/KpiGrid'

export function SimulationPage() {
  return <DashboardPageFrame eyebrow="Policy Simulation" title="정책의 결과를 시행 전에 확인하세요" description="정책과 예산, 기간을 조정하며 가장 현실적인 관광 활성화 전략을 시뮬레이션합니다." icon={FlaskConical}>
    <div className="mb-5"><KpiGrid/></div>
    <p className="mb-4 rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-900">시나리오 예시 · 아래 변화율·효과는 고정 가정입니다. 위 실데이터 기준선과 구분하며 실제 정책 효과나 방문객 예측으로 해석하지 않습니다.</p>
    <Simulation />
  </DashboardPageFrame>
}
