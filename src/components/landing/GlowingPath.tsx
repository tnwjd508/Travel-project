import { motion } from 'framer-motion'

// 콘셉트 이미지의 "굽이치며 지평선으로 모이는 길"을 그린다.
// 좌표계(viewBox 1600x360)와 컨테이너 높이는 AmbientBackground의 능선 SVG와 같아야 두 그림이 어긋나지 않는다.
// 중심선 M800 360C720 330 600 326 560 300C520 274 600 262 520 242C470 228 430 222 398 214 를
// 폭 28 → 1.5로 좁혀 만든 띠다. 멀어질수록 가늘어져 원근이 생긴다.
const ROAD = 'M800 346C720 318 600 317 560 292C520 268 600 257 520 238C470 225 430 220 398 213'
  + 'L398 215C430 224 470 231 520 246C600 267 520 280 560 308C600 342 720 342 800 374Z'

export function GlowingPath() {
  // 길 위에 얹히는 불빛. [가로 %, 세로 %]
  const particles = [[45, 94], [41, 90], [36, 85], [34, 70], [30, 64], [26, 61]]
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[36%] min-h-[220px] overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 1600 360" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <filter id="roadGlow" x="-40%" y="-90%" width="180%" height="280%"><feGaussianBlur stdDeviation="9" /></filter>
          <linearGradient id="roadColor" x1="1" y1="1" x2="0" y2="0">
            <stop stopColor="#FFB65C" stopOpacity=".45" /><stop offset=".3" stopColor="#FFD89A" stopOpacity=".88" /><stop offset=".72" stopColor="#FFF1D2" /><stop offset="1" stopColor="#FFF9EE" />
          </linearGradient>
        </defs>
        <motion.g initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.7, delay: .7, ease: [0.16, 1, 0.3, 1] }}>
          <path d={ROAD} fill="#FFB65C" fillOpacity=".4" filter="url(#roadGlow)" />
          <path d={ROAD} fill="url(#roadColor)" />
        </motion.g>
      </svg>
      {particles.map(([left, top], index) => <motion.span key={`${left}-${top}`} className="absolute h-1 w-1 rounded-full bg-[#FFD89A] shadow-[0_0_10px_#FFB65C]" style={{ left: `${left}%`, top: `${top}%` }} animate={{ opacity: [.1, 1, .1], y: [2, -4, 2] }} transition={{ duration: 2.5, repeat: Infinity, delay: 1 + index * .22 }} />)}
    </div>
  )
}
