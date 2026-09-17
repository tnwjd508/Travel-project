import { motion } from 'framer-motion'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { useCountUp } from '@/hooks/useCountUp'
import type { KpiData } from '@/data/dashboardData'

const accentClasses: Record<KpiData['accent'], { icon: string; line: string }> = {
  violet: { icon: 'bg-violet-50 text-violet-600', line: '#7C3AED' },
  blue: { icon: 'bg-blue-50 text-blue-600', line: '#2563EB' },
  green: { icon: 'bg-emerald-50 text-emerald-600', line: '#16A34A' },
  orange: { icon: 'bg-orange-50 text-orange-600', line: '#F97316' },
}

export function KpiCard({ kpi, delay = 0 }: { kpi: KpiData; delay?: number }) {
  const count = useCountUp(kpi.value)
  const { icon: Icon, label, suffix, decimals = 0, changeText, chartData, accent } = kpi
  const colors = accentClasses[accent]

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: .35, ease: 'easeOut' }}
      className="relative min-h-[172px] overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,.04)]"
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${colors.icon}`}><Icon size={17} aria-hidden="true" /></span>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
      </div>
      <div className="mt-4 flex items-baseline gap-1">
        <strong className="text-[27px] font-extrabold tracking-[-.045em] text-slate-950">
          {count.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        </strong>
        <span className="text-xs font-bold text-slate-500">{suffix}</span>
      </div>
      <p className="mt-2 text-[10px] font-semibold text-emerald-600">{changeText}</p>
      <div className="absolute bottom-4 right-4 h-11 w-24 opacity-70" aria-hidden="true">
        <ResponsiveContainer>
          <LineChart data={chartData.map((value, index) => ({ index, value }))}>
            <Line type="monotone" dataKey="value" stroke={colors.line} strokeWidth={2.2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.article>
  )
}
