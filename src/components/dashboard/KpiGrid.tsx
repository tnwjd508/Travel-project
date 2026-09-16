import { useMemo } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { overviewKpis } from '@/data/dashboardData'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'

export function KpiGrid() {
  const district = useActiveDistrict()
  const kpis = useMemo(() => {
    const values: Record<string, number> = {
      visitors: district.metrics.visitors,
      'stay-time': district.metrics.stayTime,
      spending: district.metrics.spending,
      'growth-index': district.metrics.growthIndex,
    }
    return overviewKpis.map((kpi) => {
      const value = values[kpi.id] ?? kpi.value
      const ratio = value / kpi.value
      return { ...kpi, value, chartData: kpi.chartData.map((point) => Number((point * ratio).toFixed(2))) }
    })
  }, [district])
  return (
    <section aria-labelledby="kpi-title">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="kpi-title" className="text-sm font-bold tracking-[-.02em] text-slate-900">핵심 관광 지표</h2>
        <p className="text-[10px] font-medium text-slate-400">광주광역시 {district.nameKo} 월간 데이터</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, index) => <KpiCard key={kpi.id} kpi={kpi} delay={index * .04} />)}
      </div>
    </section>
  )
}
