import { AlertCircle, ArrowUpRight, Check, MoonStar, Sparkles, Star, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

const fadeItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
}

export function AiAnalysisCard() {
  return (
    <motion.aside
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { delayChildren: 0.72, staggerChildren: 0.11 } } }}
      className="mt-6 max-w-[560px] rounded-2xl border border-blue-400/15 bg-white/[.055] p-4 shadow-[0_16px_44px_rgba(0,0,0,.2)] backdrop-blur-xl sm:p-[18px]"
    >
      <motion.div variants={fadeItem} transition={{ duration: 0.4 }} className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/15 text-blue-300">
          <Sparkles size={14} />
        </span>
        <span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2 py-1 text-[10px] font-extrabold tracking-[.04em] text-emerald-300">
          AI 분석 완료
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[9px] font-semibold text-slate-500">
          <motion.span animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.7, repeat: Infinity }} className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          실시간 분석
        </span>
      </motion.div>
      <motion.p variants={fadeItem} transition={{ duration: 0.4 }} className="mt-3 text-[12px] leading-[1.65] text-slate-300 sm:text-[13px]">
        광주광역시는 최근 <strong className="font-bold text-white">2030 관광객 비중</strong>과<br className="hidden sm:block" /> 야간 체류율이 감소하고 있습니다.
      </motion.p>
      <motion.div variants={fadeItem} transition={{ duration: 0.4 }} className="mt-3 flex items-center gap-2 rounded-xl border border-blue-400/10 bg-blue-500/[.08] px-3 py-2.5">
        <span className="text-[10px] font-bold text-blue-300">우선 검토 전략</span>
        <span className="h-3 w-px bg-white/10" />
        <span className="text-[11px] font-extrabold text-white sm:text-xs">야간 관광 콘텐츠 확대</span>
        <ArrowUpRight size={13} className="ml-auto text-blue-300" />
      </motion.div>
    </motion.aside>
  )
}

interface BriefingSignal {
  icon: LucideIcon
  label: string
  tone: 'blue' | 'amber' | 'violet'
}

const signals: BriefingSignal[] = [
  { icon: Users, label: '2030 관광객 감소', tone: 'blue' },
  { icon: MoonStar, label: '야간 관광 부족', tone: 'violet' },
  { icon: AlertCircle, label: '특정 관광지 집중', tone: 'amber' },
]

const toneClasses: Record<BriefingSignal['tone'], string> = {
  blue: 'bg-blue-50 text-blue-600 ring-blue-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
}

export function DailyBriefingPreview() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
      aria-labelledby="daily-briefing-title"
      className="relative z-20 mx-3 -mt-10 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_24px_64px_rgba(15,23,42,.14)] sm:mx-8 lg:mx-12 lg:-mt-12"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.05fr_1.3fr_1fr] lg:items-center lg:px-8">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-blue-300 shadow-lg shadow-slate-200">
            <Sparkles size={19} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-600">Daily intelligence</p>
            <h2 id="daily-briefing-title" className="mt-1 text-lg font-extrabold tracking-[-.035em] text-slate-950">오늘의 AI 브리핑</h2>
          </div>
          <div className="ml-auto text-right lg:ml-2">
            <p className="text-[10px] font-bold text-slate-400">관광 활성화 지수</p>
            <p className="mt-0.5 text-2xl font-black tracking-[-.05em] text-slate-950">74<span className="ml-0.5 text-xs font-bold text-slate-400">점</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
          {signals.map(({ icon: Icon, label, tone }) => (
            <div key={label} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 ${toneClasses[tone]}`}><Icon size={14} /></span>
              <span className="text-[11px] font-bold text-slate-600">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-300"><Check size={15} /></span>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[.12em] text-blue-300">추천 전략</p>
            <p className="mt-0.5 truncate text-xs font-extrabold">야간 관광 콘텐츠 확대</p>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <div className="flex items-center gap-1 text-[11px] font-extrabold"><Star size={12} fill="#FBBF24" className="text-amber-400" />4.8</div>
            <p className="mt-0.5 text-[8px] text-slate-500">추천도 / 5.0</p>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
