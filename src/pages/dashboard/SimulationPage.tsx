import { FlaskConical } from 'lucide-react'
import { DashboardPageFrame } from '@/components/dashboard/DashboardPageFrame'
import { Simulation } from '@/components/dashboard/Simulation'

export function SimulationPage() {
  return <DashboardPageFrame eyebrow="Policy Simulation" title="정책을 시행하기 전에 먼저 검토하세요" description="정책과 기간을 정하고, 그 정책이 겨냥하는 지표의 현재 상태를 실데이터로 확인합니다." icon={FlaskConical}>
    <Simulation />
  </DashboardPageFrame>
}
