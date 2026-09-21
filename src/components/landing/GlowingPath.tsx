import { motion } from 'framer-motion'

export function GlowingPath() {
  const particles = [[3, 97], [8, 94], [14, 87], [21, 82], [28, 78], [36, 66], [45, 56]]
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[36%] min-h-[220px] overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 1600 360" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <filter id="roadGlow" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="8" /></filter>
          <linearGradient id="roadColor" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#FFB65C" stopOpacity="0" /><stop offset=".22" stopColor="#FFD89A" /><stop offset=".72" stopColor="#F4C57A" /><stop offset="1" stopColor="#60A5FA" stopOpacity=".1" /></linearGradient>
        </defs>
        <motion.path d="M20 352C160 342 200 306 400 286C600 266 540 214 760 200" fill="none" stroke="#FFB65C" strokeOpacity=".32" strokeWidth="18" filter="url(#roadGlow)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.3, delay: .75, ease: [0.16, 1, 0.3, 1] }} />
        <motion.path d="M20 352C160 342 200 306 400 286C600 266 540 214 760 200" fill="none" stroke="url(#roadColor)" strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 2.2, delay: .72, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      {particles.map(([left, top], index) => <motion.span key={`${left}-${top}`} className="absolute h-1 w-1 rounded-full bg-[#FFD89A] shadow-[0_0_10px_#FFB65C]" style={{ left: `${left}%`, top: `${top}%` }} animate={{ opacity: [.1, 1, .1], y: [2, -4, 2] }} transition={{ duration: 2.5, repeat: Infinity, delay: 1 + index * .22 }} />)}
    </div>
  )
}
