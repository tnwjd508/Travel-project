import { DailyBriefing } from '@/components/dashboard/DailyBriefing'
import { KpiGrid } from '@/components/dashboard/KpiGrid'
import { QuickMenu } from '@/components/dashboard/QuickMenu'
import { TourismHero } from '@/components/dashboard/TourismHero'

export function OverviewPage() {
  return (
    <div className="space-y-5">
      <TourismHero />
      <DailyBriefing />
      <KpiGrid />
      <QuickMenu />
    </div>
  )
}
