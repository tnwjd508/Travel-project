import { MonthlyBriefing } from '@/components/dashboard/MonthlyBriefing'
import { KpiGrid } from '@/components/dashboard/KpiGrid'
import { QuickMenu } from '@/components/dashboard/QuickMenu'
import { TourismHero } from '@/components/dashboard/TourismHero'

export function OverviewPage() {
  return (
    <div className="space-y-5">
      <TourismHero />
      <MonthlyBriefing />
      <KpiGrid />
      <QuickMenu />
    </div>
  )
}
