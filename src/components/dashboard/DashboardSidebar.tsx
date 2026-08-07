import { CircleHelp, MapPin, RotateCcw, Settings } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { dashboardMenuItems } from '@/components/dashboard/DashboardNavigation'
import { cn } from '@/utils/cn'

export function DashboardSidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const isItemActive = (path: string) => location.pathname === path || (path.endsWith('/overview') && location.pathname === '/dashboard/gwangju')

  return (
    <aside className="fixed bottom-0 left-0 top-[72px] z-30 hidden w-[230px] flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 lg:flex" aria-label="광주 관광전략 사이드바">
      <nav className="space-y-1" aria-label="광주 관광전략 카테고리">
        {dashboardMenuItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            aria-current={isItemActive(path) ? 'page' : undefined}
            className={() => cn(
              'flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500',
              isItemActive(path) ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            )}
          >
            <Icon size={18} strokeWidth={2} aria-hidden="true" />{label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-blue-600 shadow-sm"><MapPin size={15} aria-hidden="true" /></span><div><p className="text-[9px] font-medium text-slate-400">현재 지역</p><p className="text-xs font-bold text-slate-800">광주광역시</p></div></div>
          <button type="button" onClick={() => navigate('/')} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 outline-none transition hover:border-blue-200 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"><RotateCcw size={14} />다른 지역 선택</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[11px] font-medium text-slate-500 outline-none transition hover:bg-slate-50 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="설정"><Settings size={14} />설정</button>
          <button type="button" className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[11px] font-medium text-slate-500 outline-none transition hover:bg-slate-50 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="도움말"><CircleHelp size={14} />도움말</button>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-4 text-white">
          <svg viewBox="0 0 200 54" className="absolute inset-x-0 bottom-0 h-14 w-full opacity-20" preserveAspectRatio="none" aria-hidden="true"><path d="M-10 50C36 40 34 23 82 28C126 32 131 13 210 8" fill="none" stroke="#60A5FA" strokeWidth="2" /></svg>
          <p className="relative text-sm font-extrabold tracking-[-.04em]">ON<span className="text-blue-400">:</span>GIL</p>
          <p className="relative mt-2 text-[10px] leading-4 text-slate-300">지역 관광의 길을<br />열어드립니다.</p>
        </div>
      </div>
    </aside>
  )
}
