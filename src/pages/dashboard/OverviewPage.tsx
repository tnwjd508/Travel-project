import { MonthlyBriefing } from '@/components/dashboard/MonthlyBriefing'
import { OverviewTourismIndicators } from '@/components/dashboard/OverviewTourismIndicators'
import { QuickMenu } from '@/components/dashboard/QuickMenu'
import { TourismHero } from '@/components/dashboard/TourismHero'

export function OverviewPage() {
  return (
    <div className="space-y-5">
      <TourismHero />
      <MonthlyBriefing />
      <OverviewTourismIndicators />
      <QuickMenu />
    </div>
  )
}
