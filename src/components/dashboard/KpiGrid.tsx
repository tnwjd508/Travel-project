import { KpiCard } from '@/components/dashboard/KpiCard'
import { overviewKpis } from '@/data/dashboardData'

export function KpiGrid() {
  return (
    <section aria-labelledby="kpi-title">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="kpi-title" className="text-sm font-bold tracking-[-.02em] text-slate-900">핵심 관광 지표</h2>
        <p className="text-[10px] font-medium text-slate-400">광주광역시 월간 데이터</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {overviewKpis.map((kpi, index) => <KpiCard key={kpi.id} kpi={kpi} delay={index * .04} />)}
      </div>
    </section>
  )
}
