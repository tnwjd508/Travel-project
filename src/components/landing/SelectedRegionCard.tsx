import { ArrowRight, Clock3, MapPinned, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Region } from '@/types/region'

interface SelectedRegionCardProps {
  region: Region
  onEnter: (region: Region) => void
  onUnavailable: (region: Region) => void
}

export function SelectedRegionCard({ region, onEnter, onUnavailable }: SelectedRegionCardProps) {
  const available = region.status === 'available'
  return (
    <AnimatePresence mode="wait">
      <motion.aside
        key={region.id}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: .34, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-2xl border border-white/[.1] bg-[#0B1528]/82 p-4 shadow-[0_20px_55px_rgba(0,0,0,.25)] backdrop-blur-xl sm:p-[18px]"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F4C57A]/55 to-transparent" />
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${available ? 'border-[#F4C57A]/25 bg-[#F4C57A]/10 text-[#FFD89A]' : 'border-blue-400/15 bg-blue-400/[.07] text-blue-300'}`}>
            {available ? <Sparkles size={17} /> : <MapPinned size={17} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[17px] font-semibold tracking-[-.035em] text-[#FFF9EE]">{region.nameKo}</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] ${available ? 'border-emerald-300/20 bg-emerald-300/[.08] text-emerald-300' : 'border-white/10 bg-white/[.04] text-[#78849A]'}`}>{available ? 'Data ready' : 'Coming soon'}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-5 text-[#AAB4C5]">{region.description}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => available ? onEnter(region) : onUnavailable(region)}
          className={`group mt-4 flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-xs font-semibold outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#F4C57A]/70 ${available ? 'border-[#F4C57A]/35 bg-[#F4C57A]/[.055] text-[#FFF9EE] hover:scale-[1.01] hover:border-[#FFD89A]/65 hover:bg-[#F4C57A]/10 hover:shadow-[inset_0_0_25px_rgba(244,197,122,.08)]' : 'border-white/[.08] bg-white/[.025] text-[#78849A] hover:border-white/[.14] hover:text-[#AAB4C5]'}`}
        >
          <span className="flex items-center gap-2">{available ? <Sparkles size={14} className="text-[#F4C57A]" /> : <Clock3 size={14} />}{available ? `${region.nameKo.replace('광역시', '')} 관광전략 분석하기` : '데이터 연동 준비 중'}</span>
          <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      </motion.aside>
    </AnimatePresence>
  )
}
