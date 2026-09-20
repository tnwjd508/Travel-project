import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

export function DashboardPageFrame({ eyebrow, title, description, icon: Icon, children }: { eyebrow: string; title: string; description: string; icon: LucideIcon; children: ReactNode }) {
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25, ease: 'easeOut' }}>
    <header className="mb-7 grid grid-cols-[auto_1fr] items-center gap-x-3">
      <p className="col-start-2 text-[12px] font-extrabold uppercase tracking-[.17em] text-blue-600">{eyebrow}</p>
      <span className="col-start-1 row-start-2 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-blue-300 shadow-lg shadow-slate-200"><Icon size={20}/></span>
      <h1 className="col-start-2 row-start-2 mt-1 text-2xl font-extrabold tracking-[-.04em] text-slate-950 sm:text-[30px]">{title}</h1>
      <p className="col-start-2 row-start-3 mt-2 text-xs leading-5 text-slate-500 sm:text-sm">{description}</p>
    </header>
    {children}
  </motion.div>
}
