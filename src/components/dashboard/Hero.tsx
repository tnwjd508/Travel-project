import { ArrowRight, Compass, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { AiAnalysisCard, DailyBriefingPreview } from '@/components/dashboard/HeroInsights'
import { KoreaDataMap } from '@/components/dashboard/KoreaDataMap'

const heroContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.11 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
}

export function Hero() {
  const navigate = useNavigate()

  return (
    <>
      <section className="hero-grid relative overflow-hidden rounded-[32px] bg-slate-950 text-white shadow-[0_28px_80px_rgba(15,23,42,.24)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_74%_48%,rgba(37,99,235,.2),transparent_31%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

        <div className="relative z-10 grid min-h-[690px] items-center gap-7 px-6 pb-24 pt-10 sm:px-10 sm:pt-12 md:grid-cols-[1.1fr_.9fr] md:gap-5 md:px-10 lg:min-h-[720px] lg:grid-cols-[1.05fr_.95fr] lg:px-14 xl:px-20">
          <motion.div initial="hidden" animate="visible" variants={heroContainer} className="relative z-20 max-w-[660px]">
            <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[11px] font-semibold text-blue-100 backdrop-blur-xl">
              <Sparkles size={13} className="text-blue-400" />
              AI 지역 관광전략 수립 플랫폼
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_9px_#34d399]" />
            </motion.div>

            <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-blue-600 shadow-[0_10px_32px_rgba(37,99,235,.45)]">
                <Compass size={22} strokeWidth={2.4} />
              </span>
              <p className="text-[24px] font-extrabold tracking-[-.06em] sm:text-[28px]">
                ON<span className="text-blue-400">:</span>GIL
              </p>
            </motion.div>

            <motion.h1 variants={fadeUp} transition={{ duration: 0.55 }} className="mt-7 text-[40px] font-bold leading-[1.12] tracking-[-.055em] sm:text-[49px] md:text-[44px] lg:text-[53px] xl:text-[62px]">
              AI 지역 관광전략
              <br />
              수립 <span className="bg-gradient-to-r from-blue-200 via-blue-400 to-cyan-300 bg-clip-text text-transparent">플랫폼</span>
            </motion.h1>

            <motion.p variants={fadeUp} transition={{ duration: 0.5 }} className="mt-5 text-[15px] font-medium leading-[1.7] tracking-[-.025em] text-slate-300 sm:text-[17px] lg:text-[18px]">
              <span className="block">AI가 관광 데이터를 분석해</span>
              <span className="block">정책 효과를 예측하고</span>
              <span className="block">가장 현실적인 지역 관광 전략을 제안합니다.</span>
            </motion.p>

            <AiAnalysisCard />

            <motion.button
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              onClick={() => navigate('/dashboard/gwangju/simulation')}
              className="group mt-6 inline-flex h-[54px] items-center gap-3 rounded-2xl bg-white px-6 text-sm font-extrabold text-slate-950 shadow-[0_14px_36px_rgba(0,0,0,.22)] transition-all duration-[250ms] hover:-translate-y-1 hover:bg-blue-50 hover:shadow-[0_20px_48px_rgba(37,99,235,.32)]"
            >
              AI 전략 분석 시작
              <ArrowRight size={17} className="text-blue-600 transition-transform duration-[250ms] group-hover:translate-x-1" />
            </motion.button>
          </motion.div>

          <div className="min-w-0 self-stretch md:flex md:items-center">
            <KoreaDataMap />
          </div>
        </div>
      </section>
      <DailyBriefingPreview />
    </>
  )
}
