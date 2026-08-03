import type { LucideIcon } from 'lucide-react'

export function SectionTitle({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description?: string; icon?: LucideIcon }) {
  return <div className="mb-6 flex items-end justify-between gap-4">
    <div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-blue-600">{Icon && <Icon size={14} />}{eyebrow}</div><h2 className="text-[26px] font-bold tracking-[-.04em] text-slate-950 sm:text-[30px]">{title}</h2>{description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}</div>
  </div>
}
