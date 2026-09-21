import { motion } from 'framer-motion'

const stars = [
  [8, 15, 1], [14, 38, 1.5], [22, 20, 1], [31, 12, 1.2], [38, 43, 1],
  [48, 10, 1.4], [56, 29, 1], [63, 15, 1.2], [71, 7, 1], [78, 33, 1.5],
  [86, 13, 1], [92, 27, 1.2], [97, 8, 1], [43, 62, 1], [68, 54, 1],
]

export function AmbientBackground() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.1 }} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_84%,rgba(255,182,92,.2),transparent_30%),radial-gradient(circle_at_73%_39%,rgba(59,130,246,.14),transparent_39%),linear-gradient(135deg,#050A18_0%,#071020_55%,#0A1426_100%)]" />
      <div className="absolute inset-0 opacity-[.055] [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
      {stars.map(([left, top, size], index) => (
        <motion.span key={`${left}-${top}`} className="absolute rounded-full bg-[#FFD89A]" style={{ left: `${left}%`, top: `${top}%`, width: size, height: size }} animate={{ opacity: [.15, .8, .15] }} transition={{ duration: 2.6 + (index % 4), repeat: Infinity, delay: index * .18 }} />
      ))}
      <div className="absolute bottom-[4%] left-[13%] h-52 w-[30%] rounded-full bg-[#FFB65C]/[.12] blur-[90px]" />
      <div className="absolute right-[7%] top-[16%] h-96 w-96 rounded-full bg-blue-500/[.07] blur-[100px]" />

      <svg className="absolute inset-x-0 bottom-0 h-[36%] min-h-[220px] w-full" viewBox="0 0 1600 360" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ridgeBack" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#17243A" stopOpacity=".62" /><stop offset="1" stopColor="#071020" stopOpacity=".96" /></linearGradient>
          <linearGradient id="ridgeFront" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#101B2D" /><stop offset="1" stopColor="#030713" /></linearGradient>
          {/* 해가 능선 뒤에 있는 장면. 빛 테두리는 해에 가까운 구간만 밝다 */}
          <radialGradient id="ridgeSun"><stop stopColor="#FFB65C" stopOpacity=".22" /><stop offset="1" stopColor="#FFB65C" stopOpacity="0" /></radialGradient>
          <radialGradient id="ridgeWarm" gradientUnits="userSpaceOnUse" cx="400" cy="235" r="430"><stop stopColor="#FFB65C" stopOpacity=".14" /><stop offset="1" stopColor="#FFB65C" stopOpacity="0" /></radialGradient>
          <linearGradient id="ridgeRim" gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="980" y2="0"><stop stopColor="#FFD89A" stopOpacity="0" /><stop offset=".38" stopColor="#FFEBCA" stopOpacity=".6" /><stop offset="1" stopColor="#FFD89A" stopOpacity="0" /></linearGradient>
        </defs>
        <ellipse cx="400" cy="205" rx="560" ry="160" fill="url(#ridgeSun)" />
        <path d="M0 184C120 132 189 190 286 161C387 130 435 205 554 169C672 133 734 187 846 157C967 125 1044 196 1160 163C1288 126 1402 168 1600 112V360H0Z" fill="url(#ridgeBack)" />
        <path d="M0 184C120 132 189 190 286 161C387 130 435 205 554 169C672 133 734 187 846 157C967 125 1044 196 1160 163C1288 126 1402 168 1600 112" fill="none" stroke="url(#ridgeRim)" strokeWidth="2" opacity=".75" />
        <path d="M0 247C154 191 258 268 391 226C519 186 598 269 744 225C891 181 1018 271 1173 222C1325 174 1437 231 1600 188V360H0Z" fill="url(#ridgeFront)" />
        <path d="M0 247C154 191 258 268 391 226C519 186 598 269 744 225C891 181 1018 271 1173 222C1325 174 1437 231 1600 188V360H0Z" fill="url(#ridgeWarm)" />
        <path d="M0 247C154 191 258 268 391 226C519 186 598 269 744 225C891 181 1018 271 1173 222C1325 174 1437 231 1600 188" fill="none" stroke="url(#ridgeRim)" strokeWidth="2.4" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#030713] via-[#030713]/65 to-transparent" />
    </motion.div>
  )
}
