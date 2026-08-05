import { ArrowRight, Banknote, Clock3, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Hero } from '@/components/dashboard/Hero'
import { KpiCard } from '@/components/dashboard/KpiCard'

export function OverviewPage() {
  return <div className="space-y-5">
    <Hero />
    <section aria-label="광주 관광 핵심 지표" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="월 관광객" value={482000} suffix="명" change={8.7} icon={Users} data={[22,26,24,31,34,39,42]}/>
      <KpiCard label="평균 체류시간" value={31.8} suffix="시간" decimals={1} change={5.2} icon={Clock3} data={[22,24,25,25,28,29,32]} delay={.06}/>
      <KpiCard label="1인 관광 소비" value={148000} suffix="원" change={11.4} icon={Banknote} data={[31,29,34,36,38,43,49]} delay={.12}/>
      <KpiCard label="관광 성장지수" value={12.4} suffix="점" decimals={1} change={3.1} icon={TrendingUp} data={[19,23,22,27,31,34,38]} delay={.18}/>
    </section>
    <div className="flex justify-end pt-1"><Link to="/dashboard/gwangju/analytics" className="group inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">상세 관광 데이터 보기<ArrowRight size={14} className="transition-transform group-hover:translate-x-1"/></Link></div>
  </div>
}
