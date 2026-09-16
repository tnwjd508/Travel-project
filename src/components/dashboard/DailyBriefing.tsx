import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { briefingSignals, type BriefingSignal } from '@/data/dashboardData'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { OngoingFestivals } from '@/components/dashboard/OngoingFestivals'

const signalTone: Record<BriefingSignal['tone'], string> = {
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  orange: 'bg-orange-50 text-orange-600',
}

const effects = [
  ['+15.2%', '방문객 증가'],
  ['+21.3%', '체류시간 증가'],
  ['+18.6%', '관광 소비 증가'],
]

export function DailyBriefing() {
  const district = useActiveDistrict()
  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)] sm:p-7" aria-labelledby="briefing-title">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Sparkles size={18} aria-hidden="true" /></span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-blue-600">Daily briefing</p>
          <h2 id="briefing-title" className="mt-0.5 text-lg font-bold tracking-[-.03em] text-slate-950">오늘의 브리핑 <span className="text-blue-600">(AI)</span></h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">AI Confidence 92%</span>
        <p className="ml-auto text-[11px] font-medium text-slate-400">오늘 09:30 기준</p>
      </header>

      <div className="grid gap-7 pt-6 lg:grid-cols-[1fr_1.08fr_1fr] lg:gap-0">
        <div className="lg:pr-7">
          <h3 className="text-xs font-bold text-slate-900">핵심 진단</h3>
          <div className="mt-4 space-y-4">
            {briefingSignals.map(({ id, title, description, icon: Icon, tone }) => (
              <div key={id} className="flex items-start gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${signalTone[tone]}`}><Icon size={16} aria-hidden="true" /></span>
                <div><p className="text-xs font-bold text-slate-800">{title}</p><p className="mt-1 text-[11px] text-slate-500">{description}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-y border-slate-100 py-6 lg:border-x lg:border-y-0 lg:px-7 lg:py-0">
          <OngoingFestivals />
        </div>

        <div className="lg:pl-7">
          <h3 className="text-xs font-bold text-slate-900">AI 추천 전략</h3>
          <div className="mt-4 rounded-2xl bg-orange-50/80 p-4 ring-1 ring-orange-100/80">
            <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-orange-500 shadow-sm"><Check size={15} aria-hidden="true" /></span><p className="text-sm font-bold text-slate-900">야간관광 콘텐츠 확대</p></div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-orange-100 pt-4">
              {effects.map(([value, label]) => <div key={label}><strong className="block text-base font-extrabold tracking-[-.03em] text-orange-600">{value}</strong><span className="mt-1 block text-[9px] font-medium text-slate-500">{label}</span></div>)}
            </div>
          </div>
          <Link to={`/dashboard/gwangju/${district.slug}/diagnosis`} className="mt-4 ml-auto flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold text-blue-600 outline-none transition hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500">
            자세히 보기 <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-5 text-xs leading-6 sm:text-sm">
        <h3 className="shrink-0 font-bold text-slate-900">AI 한줄 요약</h3>
        <p className="font-medium text-slate-700">{district.nameKo}는 2030 관광객 감소와 야간 체류 부족이 주요 문제이며, {district.tourismType} 콘텐츠 확대가 효과적인 해결책으로 분석됩니다.</p>
      </div>
    </section>
  )
}
