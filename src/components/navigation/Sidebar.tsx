import { BarChart3, Bot, Compass, Gauge, MapPinned, Settings, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

const items = [
  { icon: Gauge, label: '대시보드', active: true }, { icon: Bot, label: 'AI 진단' },
  { icon: Sparkles, label: '시뮬레이션' }, { icon: BarChart3, label: '성과 예측' },
  { icon: MapPinned, label: '지역 탐색' },
]

export function Sidebar() {
  return <aside className="fixed inset-y-0 left-0 z-40 hidden w-[104px] border-r border-slate-200/70 bg-white/75 backdrop-blur-2xl lg:flex lg:flex-col lg:items-center">
    <div className="flex h-[82px] w-full items-center justify-center border-b border-slate-100"><div className="grid h-11 w-11 place-items-center rounded-[15px] bg-slate-950 text-white shadow-lg shadow-slate-300"><Compass size={22} strokeWidth={2.4}/></div></div>
    <nav className="flex flex-1 flex-col items-center gap-3 pt-7">{items.map(({icon: Icon, label, active}) => <button key={label} className={`group relative grid h-[52px] w-14 place-items-center rounded-2xl py-3 transition ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`} aria-label={label} title={label}>{active && <motion.span layoutId="side" className="absolute -left-[25px] h-7 w-1 rounded-r-full bg-blue-600"/>}<Icon size={20}/><span className="pointer-events-none absolute left-[66px] z-50 whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover:opacity-100">{label}</span></button>)}</nav>
    <button className="mb-7 grid h-12 w-12 place-items-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="설정"><Settings size={20}/></button>
  </aside>
}
