import { AnimatePresence, motion } from 'framer-motion'

export function LandingTransition({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .55 }} className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-[#050A18]" aria-live="polite" aria-label="광주 관광전략 분석 화면으로 이동 중">
          <motion.div initial={{ scale: 0, opacity: .7 }} animate={{ scale: 9, opacity: 0 }} transition={{ duration: .7, ease: [0.16, 1, 0.3, 1] }} className="h-28 w-28 rounded-full border border-[#FFD89A]/70 bg-[#F4C57A]/25 shadow-[0_0_80px_rgba(244,197,122,.55)]" />
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }} className="absolute text-xs font-semibold tracking-[.18em] text-[#FFF9EE]">빛나는 전략의 길을 여는 중</motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
