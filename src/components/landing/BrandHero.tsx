import { ArrowDownRight } from 'lucide-react'
import { motion } from 'framer-motion'

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
}

export function BrandHero() {
  return (
    <motion.section initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: .13, delayChildren: .18 } } }} className="relative z-10 flex max-w-[700px] flex-col justify-center pt-8 lg:min-h-[720px] lg:pt-0">
      <motion.div variants={fadeUp} transition={{ duration: .65 }} className="mb-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.28em] text-[#AAB4C5] sm:mb-8">
        <span className="h-px w-9 bg-gradient-to-r from-[#F4C57A] to-transparent" />
        AI Regional Tourism Strategy
      </motion.div>

      <motion.h1 variants={fadeUp} transition={{ duration: .72, ease: [0.16, 1, 0.3, 1] }} className="whitespace-nowrap text-[62px] font-light leading-none tracking-[-.075em] text-[#F8F4EC] min-[430px]:text-[72px] sm:text-[96px] lg:text-[clamp(96px,9vw,144px)]">
        ON<span className="mx-[.02em] bg-gradient-to-b from-[#FFF1D2] via-[#F4C57A] to-[#FFB65C] bg-clip-text font-normal text-transparent drop-shadow-[0_0_24px_rgba(244,197,122,.32)]">:</span><span className="font-normal">GIL</span>
      </motion.h1>

      <motion.div variants={fadeUp} transition={{ duration: .68 }} className="mt-7 sm:mt-9">
        <h2 className="max-w-[650px] text-[23px] font-medium leading-[1.45] tracking-[-.04em] text-[#F8F4EC] sm:text-[30px] lg:text-[34px]">
          ON:GIL이 지역 관광의
          <br className="sm:hidden" /> <span className="bg-gradient-to-r from-[#FFD89A] via-[#F4C57A] to-[#93C5FD] bg-clip-text text-transparent">길을 열어드립니다.</span>
        </h2>
        <p className="mt-5 max-w-[570px] text-sm leading-7 tracking-[-.012em] text-[#AAB4C5] sm:text-[16px] sm:leading-8">
          AI가 관광 데이터를 분석하여 지역 관광의 가능성을 발견하고,<br className="hidden sm:block" />
          더 나은 미래로 나아가는 길을 제시합니다.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} transition={{ duration: .6 }} className="mt-8 flex items-center gap-4 sm:mt-10">
        <button onClick={() => document.getElementById('region-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="group inline-flex min-h-11 items-center gap-3 text-[11px] font-semibold uppercase tracking-[.23em] text-[#F4C57A] outline-none transition-colors hover:text-[#FFF9EE] focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[#F4C57A]/70">
          Explore Korea
          <span className="grid h-10 w-10 place-items-center rounded-full border border-[#F4C57A]/45 transition-all duration-300 group-hover:border-[#FFD89A] group-hover:bg-[#F4C57A]/10 group-hover:shadow-[0_0_24px_rgba(244,197,122,.18)]">
            <ArrowDownRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5" />
          </span>
        </button>
      </motion.div>

      <motion.p variants={fadeUp} transition={{ duration: .7 }} className="mt-12 text-[12px] font-light tracking-[.07em] text-[#78849A] sm:mt-14">
        길을 열면, 지역이 빛납니다.
      </motion.p>
    </motion.section>
  )
}
