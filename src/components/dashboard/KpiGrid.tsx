import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { useDistrictResource } from '@/hooks/useDistrictResource'
import { DataNotice, SourceNote, formatValue } from './DataNotice'

export function KpiGrid() {
  const district = useActiveDistrict()
  const state = useDistrictResource('summary', { district: district.slug })
  const summary = state.data
  const kpis = summary ? [
    { label: '일별 방문 추정치 월 합계', value: summary.visitors.total, unit: '일별 추정치 합산', note: `기준월 ${summary.visitors.month} · 전월 대비 ${summary.visitors.momPct == null ? '자료 없음' : `${summary.visitors.momPct > 0 ? '+' : ''}${summary.visitors.momPct}%`}`, decimals: 0 },
    { label: '관광체류강도', value: summary.stay.ix21, unit: '지수', note: '관광 체류의 상대 수준', decimals: 2 },
    { label: '관광소비강도', value: summary.spend.ix22, unit: '지수', note: '관광 소비의 상대 수준', decimals: 2 },
    { label: '관광서비스수요', value: summary.demand.ix11, unit: '지수', note: '관광서비스 수요의 상대 수준', decimals: 2 },
  ] : []
  return (
    <section aria-labelledby="kpi-title">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="kpi-title" className="text-sm font-bold tracking-[-.02em] text-slate-900">핵심 관광 지표</h2>
        <p className="text-[10px] font-medium text-slate-400">{district.regionName} {district.nameKo} 월간 데이터</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(kpi => <article key={kpi.label} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xs font-semibold text-slate-500">{kpi.label}</h3><p className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950">{formatValue(kpi.value, kpi.decimals)}</p><p className="mt-1 text-xs text-slate-500">{kpi.unit}</p><p className="mt-3 text-[11px] leading-5 text-slate-500">{kpi.note}</p></article>)}
      </div>
      <DataNotice state={state}/>
      {summary && <SourceNote data={summary}/>}
    </section>
  )
}
