import { FlaskConical } from 'lucide-react'
import { DashboardPageFrame } from '@/components/dashboard/DashboardPageFrame'
import { Simulation } from '@/components/dashboard/Simulation'

export function SimulationPage() {
  return <DashboardPageFrame eyebrow="Policy Simulation" title="정책의 결과를 시행 전에 확인하세요" description="정책과 예산, 기간을 조정하며 가장 현실적인 관광 활성화 전략을 시뮬레이션합니다." icon={FlaskConical}>
    <Simulation />
  </DashboardPageFrame>
}
