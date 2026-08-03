import { ArrowRight, Compass, MapPin, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

export function Hero() {
  const startSimulation = () => document.getElementById('simulation')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65 }}
      className="hero-grid relative min-h-[610px] overflow-hidden rounded-[32px] bg-slate-950 text-white shadow-[0_28px_80px_rgba(15,23,42,.24)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_73%_47%,rgba(37,99,235,.2),transparent_30%)]" />
      <div className="relative z-10 grid min-h-[610px] items-center gap-8 px-6 py-12 sm:px-10 lg:grid-cols-[1.05fr_.95fr] lg:px-14 xl:px-20">
        <div className="max-w-[660px]">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[11px] font-semibold text-blue-100 backdrop-blur-xl">
            <Sparkles size={13} className="text-blue-400" />
            AI 지역 관광전략 수립 플랫폼
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_9px_#34d399]" />
          </div>

          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-blue-600 shadow-[0_10px_32px_rgba(37,99,235,.45)]">
              <Compass size={22} strokeWidth={2.4} />
            </span>
            <p className="text-[24px] font-extrabold tracking-[-.06em] sm:text-[28px]">
              ON<span className="text-blue-400">:</span>GIL
            </p>
          </div>

          <h1 className="mt-8 text-[40px] font-bold leading-[1.14] tracking-[-.055em] sm:text-[52px] xl:text-[62px]">
            AI 지역 관광전략
            <br />
            <span className="bg-gradient-to-r from-white via-blue-100 to-blue-400 bg-clip-text text-transparent">수립 플랫폼</span>
          </h1>
          <p className="mt-6 text-[17px] font-medium tracking-[-.025em] text-slate-300 sm:text-xl">
            AI가 지역 관광의 길을 제시합니다.
          </p>
          <p className="mt-3 max-w-lg text-sm leading-7 text-slate-500">
            관광 데이터로 지역의 현재를 진단하고, 정책 효과를 미리 예측해
            가장 현실적인 성장 전략을 설계합니다.
          </p>

          <button
            onClick={startSimulation}
            className="group mt-9 inline-flex h-[54px] items-center gap-3 rounded-2xl bg-white px-6 text-sm font-bold text-slate-950 shadow-[0_14px_36px_rgba(0,0,0,.22)] transition-all duration-300 hover:-translate-y-1 hover:bg-blue-50 hover:shadow-[0_18px_44px_rgba(37,99,235,.3)]"
          >
            정책 시뮬레이션 시작
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white transition-transform group-hover:translate-x-1">
              <ArrowRight size={14} />
            </span>
          </button>
        </div>

        <div className="relative hidden h-[520px] items-center justify-center lg:flex" aria-label="대한민국 지도에서 강조된 광주광역시">
          <div className="absolute left-1/2 top-1/2 h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[.06]" />
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-blue-300/10" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            className="absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[.05]"
          >
            <span className="absolute left-1/2 top-[-4px] h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_16px_#60a5fa]" />
          </motion.div>

          <svg viewBox="0 0 360 510" className="relative z-10 h-[460px] w-[330px] overflow-visible drop-shadow-[0_22px_38px_rgba(0,0,0,.3)]">
            <defs>
              <linearGradient id="koreaFill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="58%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#172033" />
              </linearGradient>
              <filter id="gwangjuGlow" x="-300%" y="-300%" width="700%" height="700%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* 한반도 남부를 추상화한 프리미엄 지도 실루엣 */}
            <path
              d="M160 20c20 10 33 30 48 45 17 17 43 23 51 47 8 25-6 48 3 72 9 25 39 39 38 67-1 24-24 41-27 65-3 22 12 43 3 65-9 23-35 31-57 36-24 5-43 25-68 21-23-4-34-27-53-39-18-11-47-8-56-30-10-24 15-45 16-69 1-25-24-47-14-70 11-26 43-38 50-65 7-24-7-50 6-70 13-20 39-20 54-36 16-17 19-47 41-56 10-4 20-3 29 2Z"
              fill="url(#koreaFill)"
              stroke="#475569"
              strokeWidth="2"
            />
            <path d="M112 462c22-9 62-8 82 1 7 3 5 11-2 14-20 9-60 10-82 1-8-3-7-12 2-16Z" fill="#253248" stroke="#475569" strokeWidth="1.5" />
            <path d="M306 337c8-3 18 1 20 8 2 8-7 14-15 12-8-1-12-8-9-14 1-3 2-5 4-6Z" fill="#253248" stroke="#475569" />

            {/* 내부 데이터 경계 */}
            <g fill="none" stroke="#64748B" strokeOpacity=".24" strokeWidth="1">
              <path d="M97 119c42 10 92 2 150 15" />
              <path d="M76 198c63 17 130 8 201-5" />
              <path d="M65 282c73-4 141 12 219 27" />
              <path d="M87 367c51-26 116-18 180 8" />
              <path d="M148 59c-12 80 5 159-9 235-7 39-3 79 9 119" />
              <path d="M220 80c-20 82-8 162 5 240 5 33 1 61-10 91" />
            </g>

            {/* 광주 위치 */}
            <motion.g
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.65, type: 'spring', stiffness: 180 }}
              style={{ transformOrigin: '116px 343px' }}
            >
              <circle cx="116" cy="343" r="29" fill="#2563EB" opacity=".13" filter="url(#gwangjuGlow)" />
              <motion.circle cx="116" cy="343" r="19" fill="none" stroke="#60A5FA" strokeWidth="1.5" animate={{ r: [15, 27], opacity: [.9, 0] }} transition={{ duration: 2, repeat: Infinity }} />
              <circle cx="116" cy="343" r="8" fill="#2563EB" stroke="#fff" strokeWidth="3" filter="url(#gwangjuGlow)" />
              <circle cx="116" cy="343" r="2.5" fill="#fff" />
            </motion.g>
          </svg>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="absolute bottom-[108px] right-[-6px] z-20 rounded-2xl border border-blue-400/20 bg-slate-900/80 p-4 shadow-[0_18px_48px_rgba(0,0,0,.25)] backdrop-blur-xl xl:right-5"
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-blue-400">
              <MapPin size={13} />Selected region
            </div>
            <div className="mt-2 flex items-end gap-5">
              <div><p className="text-lg font-bold">광주광역시</p><p className="mt-0.5 text-[10px] text-slate-500">대한민국 문화관광 거점</p></div>
              <span className="mb-0.5 rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-bold text-emerald-400">LIVE</span>
            </div>
          </motion.div>

          <div className="absolute left-8 top-14 rounded-full border border-white/10 bg-white/[.05] px-3 py-1.5 text-[10px] font-semibold text-slate-400 backdrop-blur">대한민국 관광 데이터</div>
        </div>

        <div className="relative mx-auto mt-4 block h-[330px] w-full max-w-[300px] lg:hidden">
          <svg viewBox="0 0 360 510" className="h-full w-full drop-shadow-[0_18px_32px_rgba(0,0,0,.3)]">
            <path d="M160 20c20 10 33 30 48 45 17 17 43 23 51 47 8 25-6 48 3 72 9 25 39 39 38 67-1 24-24 41-27 65-3 22 12 43 3 65-9 23-35 31-57 36-24 5-43 25-68 21-23-4-34-27-53-39-18-11-47-8-56-30-10-24 15-45 16-69 1-25-24-47-14-70 11-26 43-38 50-65 7-24-7-50 6-70 13-20 39-20 54-36 16-17 19-47 41-56 10-4 20-3 29 2Z" fill="#1E293B" stroke="#475569" strokeWidth="2" />
            <path d="M112 462c22-9 62-8 82 1 7 3 5 11-2 14-20 9-60 10-82 1-8-3-7-12 2-16Z" fill="#253248" stroke="#475569" />
            <circle cx="116" cy="343" r="22" fill="#2563EB" opacity=".2" />
            <circle cx="116" cy="343" r="8" fill="#2563EB" stroke="#fff" strokeWidth="3" />
          </svg>
          <div className="absolute bottom-6 right-0 rounded-xl border border-blue-400/20 bg-slate-900/90 px-3 py-2 text-xs font-bold shadow-xl">광주광역시 <span className="ml-1 text-blue-400">●</span></div>
        </div>
      </div>
    </motion.section>
  )
}
