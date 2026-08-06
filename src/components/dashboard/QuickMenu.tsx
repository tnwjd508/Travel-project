import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { quickMenuItems } from '@/data/dashboardData'

export function QuickMenu() {
  return (
    <section aria-labelledby="quick-menu-title">
      <h2 id="quick-menu-title" className="mb-3 text-sm font-bold tracking-[-.02em] text-slate-900">빠른 메뉴</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {quickMenuItems.map(({ id, title, subtitle, path, icon: Icon }) => (
          <Link
            key={id}
            to={path}
            className="group flex min-h-[92px] items-center gap-3 rounded-[18px] border border-slate-200/90 bg-white px-4 shadow-[0_6px_20px_rgba(15,23,42,.035)] outline-none transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_28px_rgba(37,99,235,.08)] focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500 transition group-hover:bg-blue-50 group-hover:text-blue-600"><Icon size={18} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-xs font-bold text-slate-800">{title}</strong><span className="mt-1 block text-[10px] font-medium text-slate-400">{subtitle}</span></span>
            <ArrowUpRight size={14} className="shrink-0 text-slate-300 transition group-hover:text-blue-500" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  )
}
