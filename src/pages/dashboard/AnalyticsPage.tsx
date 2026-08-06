import { BarChart3 } from 'lucide-react'
import { DashboardPageFrame } from '@/components/dashboard/DashboardPageFrame'
import { TourismCharts } from '@/components/dashboard/TourismCharts'
import { TourismMap } from '@/components/dashboard/TourismMap'

export function AnalyticsPage() {
  return <DashboardPageFrame eyebrow="Tourism Analytics" title="관광 데이터를 입체적으로 분석합니다" description="월별 방문 흐름과 방문객 특성, 관광 유형과 공간 분포를 확인하세요." icon={BarChart3}>
    <div className="space-y-5"><TourismCharts/><TourismMap/></div>
  </DashboardPageFrame>
}
