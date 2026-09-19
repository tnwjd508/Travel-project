import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { useDistrictResource } from '@/hooks/useDistrictResource'
import { OngoingFestivals } from '@/components/dashboard/OngoingFestivals'
import { DataNotice, SourceNote } from './DataNotice'

export function DailyBriefing() {
  const district = useActiveDistrict()
  const state = useDistrictResource('diagnosis', { district: district.slug })
  return <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="briefing-title">
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-5">
      <Sparkles className="text-blue-600" size={20}/><h2 id="briefing-title" className="text-lg font-bold">{district.nameKo} 데이터 브리핑</h2>
      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">규칙 기반 · 검토용 모델</span>
    </header>
    <div className="grid gap-6 pt-5 lg:grid-cols-3">
      <div><h3 className="mb-3 text-sm font-bold">핵심 지표</h3><DataNotice state={state}/><div className="space-y-3">{state.data?.issues.slice(0, 3).map(issue => <div key={issue.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-800">{issue.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{issue.evidence}</p></div>)}</div></div>
      <div className="border-y border-slate-100 py-4 lg:border-x lg:border-y-0 lg:px-5 lg:py-0"><OngoingFestivals/></div>
      <div><h3 className="text-sm font-bold">검토할 개선 과제</h3>{state.data && <div className="mt-3 space-y-3">{state.data.priorities.length ? state.data.priorities.map(item => <p key={item.issueId} className="rounded-xl bg-blue-50 p-3 text-xs font-medium leading-5 text-blue-900">{item.title}</p>) : <p className="text-xs leading-6 text-slate-500">현재 규칙에서 도출된 개선 과제가 없습니다. 누락 여부는 지표를 확인하세요.</p>}</div>}<Link to={`/dashboard/gwangju/${district.slug}/diagnosis`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-bold text-blue-600">근거 자세히 보기 <ArrowRight size={14}/></Link></div>
    </div>
    {state.data && <SourceNote data={state.data}/>}
  </section>
}
