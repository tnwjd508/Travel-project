import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Compass, MapPinned, X } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { dashboardMenuItems } from '@/components/dashboard/DashboardNavigation'
import { cn } from '@/utils/cn'

export function MobileDashboardMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()

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

  return <AnimatePresence>{open && <>
    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm lg:hidden" aria-label="메뉴 닫기"/>
    <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: .25, ease: [0.16, 1, 0.3, 1] }} className="fixed inset-y-0 left-0 z-[60] w-[min(88vw,340px)] overflow-y-auto bg-white p-5 shadow-2xl lg:hidden" aria-label="모바일 대시보드 메뉴">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white"><Compass size={19}/></span><div><p className="font-extrabold tracking-[-.04em]">ON<span className="text-blue-600">:</span>GIL</p><p className="text-[10px] text-slate-400">광주 관광전략</p></div></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="메뉴 닫기"><X size={19}/></button></div>
      <nav className="mt-8 space-y-1" aria-label="광주 관광전략 카테고리">{dashboardMenuItems.map(({ label, path, icon: Icon, description }) => <NavLink key={path} to={path} onClick={onClose} className={({ isActive }) => cn('flex min-h-[62px] items-center gap-3 rounded-2xl px-3 transition', isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800')}><span className="grid h-9 w-9 place-items-center rounded-xl bg-white shadow-sm"><Icon size={17}/></span><span className="min-w-0 flex-1"><b className="block text-sm">{label}</b><span className="mt-0.5 block truncate text-[10px] font-medium opacity-60">{description}</span></span><ChevronRight size={15} className="opacity-40"/></NavLink>)}</nav>
      <button onClick={() => { onClose(); navigate('/') }} className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><MapPinned size={15}/>지역 다시 선택</button>
    </motion.aside>
  </>}</AnimatePresence>
}
