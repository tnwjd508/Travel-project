import { CalendarDays, MapPin } from 'lucide-react'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { useDistrictResource } from '@/hooks/useDistrictResource'
import { DataNotice } from './DataNotice'

function dateLabel(value: string) { return `${value.slice(0,4)}.${value.slice(4,6)}.${value.slice(6,8)}` }
export function OngoingFestivals() {
  const district = useActiveDistrict()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/-/g, '')
  const state = useDistrictResource('festivals', { district: district.slug, from: `${today.slice(0,4)}0101` })
  const festivals = state.data?.items.filter(item => item.start && item.end && item.start <= today && item.end >= today) ?? []
  return <section aria-labelledby="festivals-title"><h3 id="festivals-title" className="text-xs font-bold">{district.nameKo} 진행 중 축제</h3><div className="mt-4"><DataNotice state={state}/></div>
    {state.data && (festivals.length ? <div className="mt-3 max-h-64 space-y-3 overflow-y-auto">{festivals.map(item => <article key={item.contentId} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><h4 className="text-xs font-bold">{item.title}</h4><p className="mt-2 flex gap-2 text-[11px] text-blue-700"><CalendarDays size={13}/>{dateLabel(item.start)} ~ {dateLabel(item.end)}</p><p className="mt-2 flex gap-2 text-[11px] text-slate-500"><MapPin size={13}/>{item.place}</p></article>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">올해 시작한 행사 중 현재 등록된 진행 중 축제가 없습니다.</p>)}
    {state.data && <p className="mt-3 text-[10px] leading-5 text-slate-500">{dateLabel(today)} 기준 · {state.data.source}</p>}
  </section>
}
