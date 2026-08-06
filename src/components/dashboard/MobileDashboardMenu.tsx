import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, CircleHelp, MapPin, RotateCcw, Settings, X } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { dashboardMenuItems } from '@/components/dashboard/DashboardNavigation'
import { cn } from '@/utils/cn'

export function MobileDashboardMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const isItemActive = (path: string) => location.pathname === path || (path.endsWith('/overview') && location.pathname === '/dashboard/gwangju')

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-slate-950/30 lg:hidden" aria-label="메뉴 닫기" />
          <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: .22, ease: [0.16, 1, 0.3, 1] }} className="fixed inset-y-0 left-0 z-[60] flex w-[min(88vw,330px)] flex-col overflow-y-auto bg-white p-5 shadow-2xl lg:hidden" aria-label="모바일 대시보드 메뉴">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div><div className="flex items-center gap-2"><p className="text-lg font-extrabold tracking-[-.05em]">ON<span className="text-blue-600">:</span>GIL</p><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-600">AI</span></div><p className="mt-1 text-[10px] text-slate-400">AI 지역 관광전략 수립 플랫폼</p></div>
              <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="메뉴 닫기"><X size={19} /></button>
            </div>

            <nav className="mt-5 space-y-1" aria-label="광주 관광전략 카테고리">
              {dashboardMenuItems.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={onClose}
                  aria-current={isItemActive(path) ? 'page' : undefined}
                  className={() => cn('flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500', isItemActive(path) ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}
                >
                  <Icon size={18} aria-hidden="true" /><span className="flex-1">{label}</span><ChevronRight size={14} className="opacity-35" aria-hidden="true" />
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto space-y-3 pt-8">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center gap-2"><MapPin size={15} className="text-blue-600" /><div><p className="text-[9px] text-slate-400">현재 지역</p><p className="text-xs font-bold text-slate-800">광주광역시</p></div></div>
                <button type="button" onClick={() => { onClose(); navigate('/') }} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><RotateCcw size={14} />다른 지역 선택</button>
              </div>
              <div className="grid grid-cols-2 gap-2"><button type="button" className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs text-slate-500 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"><Settings size={14} />설정</button><button type="button" className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs text-slate-500 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"><CircleHelp size={14} />도움말</button></div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
