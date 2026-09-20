import { CalendarDays, ChevronDown, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDashboardRegion } from '@/hooks/useDashboardRegion'

export function DashboardHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate()
  const district = useDashboardRegion()

  return (
    <header className="sticky top-0 z-40 h-[72px] border-b border-slate-200 bg-white">
      <div className="flex h-full items-center gap-2 px-4 sm:px-6 lg:px-7">
        <button type="button" onClick={onMenuClick} className="grid h-11 w-11 place-items-center rounded-xl text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden" aria-label="대시보드 메뉴 열기"><Menu size={20} /></button>

        <button type="button" onClick={() => navigate(district.dashboardPath)} className="mr-auto min-w-0 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          <div className="flex items-center gap-2"><span className="text-xl font-extrabold tracking-[-.06em] text-slate-950">ON<span className="text-blue-600">:</span>GIL</span><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-blue-600">AI</span></div>
          <p className="hidden text-[10px] font-medium text-slate-400 sm:block">AI 지역 관광전략 수립 플랫폼</p>
        </button>

        <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 md:flex"><CalendarDays size={15} className="text-slate-400" aria-hidden="true" />{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}</div>
        <span className="mx-2 hidden h-5 w-px bg-slate-200 md:block" />
        <button type="button" onClick={() => navigate(district.selectionPath)} className="hidden min-h-11 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold text-slate-700 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex" aria-label={`${district.regionName} 시군구 선택 화면으로 이동`}><span className="h-2 w-2 rounded-full bg-blue-600" />{district.regionName} {district.nameKo}<ChevronDown size={13} className="text-slate-400" /></button>


        <div className="hidden items-center gap-2.5 border-l border-slate-200 pl-4 xl:flex">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-[10px] font-bold text-white">{district.nameKo}</div>
          <div className="leading-tight"><p className="text-xs font-bold text-slate-800">지자체 대시보드</p><p className="mt-0.5 text-[10px] text-slate-400">{district.regionName} {district.nameKo}</p></div>
        </div>
      </div>
    </header>
  )
}
