import { MapPin } from 'lucide-react'
import { motion } from 'framer-motion'

// Simplified from the public-domain Natural Earth / geoBoundaries outline.
const KOREA_OUTLINE =
  'M235.7,46.6L220.5,36.5L207.6,54.7L180.9,54.9L139.4,55.6L114.9,70.8L96.6,85.2L98.1,96.6L103.5,108.9L96.7,100.3L86.5,98.6L90.9,114L94.9,119.4L93.9,125.7L100.8,129.4L106.6,135.9L112,137.4L106.3,141.6L102.2,139.3L96,139.1L97.9,144.1L98.1,148.9L107.1,144.6L112.4,145.4L104.2,149.9L110,155.7L113.9,151.6L112.4,157.5L118.1,165.1L124.8,160.9L122.3,164.9L112.3,170.8L110.8,178.6L109.2,171.9L105.5,167.8L96.5,160.1L94.2,164.9L91.3,158.4L84.8,157.9L87.7,161.3L89.7,166.2L85.3,163.3L81.5,170.7L81.7,163.2L79.8,160.6L75.5,160L73.8,160.5L74.3,163.8L74.4,169.4L72.7,171.8L68.3,175.6L68.6,171.2L68.9,162.9L66,169.4L60.1,169.3L62.4,174.9L57.8,174.7L56.5,181.9L61.8,180.8L59.1,185L68.6,188.1L71.8,190L70.3,182.9L74.5,182.7L79.5,187.8L80.5,180.6L81.9,183.9L85.4,188.7L81.1,192L83.2,196.4L83.7,202.8L88.2,202.2L85.4,208.7L84.9,212.7L87.6,221.9L88.6,223.8L87.8,227L95,231.5L100.3,237.6L110.7,235.3L85.5,240.5L101.8,247.2L108,247.4L100.1,249.4L106.1,255.6L93.8,255.9L84.9,271.6L93.3,272.2L78.1,284.1L77,287.9L72.8,296.6L71.3,298.7L73.5,301.9L79.8,308.7L76.6,313.2L72.8,309.5L71.8,304.7L64.9,307.4L68.6,310.1L70.3,318.9L71.9,322.9L76.2,318.3L76.3,323.8L76.5,330L77.6,333.5L83.9,332.3L87.6,329L90.7,326.3L93.7,330.9L92.7,333.7L84.3,336.8L75.4,338.2L88.7,343.1L86.3,344.5L81.5,344.1L74.5,339.9L77.4,344.5L81.1,349.9L72.1,341.7L67.7,336.8L70.2,348L68.1,349.5L72.8,350.9L79.1,353.4L84.4,352.3L84.9,353.9L81.6,356.9L82,361.8L83,366L86.1,370L91.9,370.7L98.3,362L99.9,360.5L103.8,353.1L107.4,351.2L111.3,361.5L117,360.7L123.1,347.7L131.9,342.4L140.3,337L148.8,339.6L145,343.6L140.8,343.1L139.4,350.6L136.1,348.5L133.6,355L143.5,357.4L152.4,356.2L149.2,349.8L159.5,350.5L158.2,343.8L152.7,336.3L155,332.8L159.5,329.8L162.9,326.6L164.8,332.7L165.1,342L171.9,346.6L174.5,338.6L180.5,329.7L171.1,330.7L167.8,321.3L177.7,319.9L180.6,320.4L190.9,321.3L197.7,317.7L204.6,310.6L203.5,322.5L208.5,325L216.5,322L226.8,324.2L230.8,328.5L234.7,324.7L233.1,319.9L236.1,317.9L227.8,316.6L236.3,311.2L245.1,311.2L247.3,311.7L243.7,303L247.1,304.7L252.1,306L257.8,310.8L267.6,308.8L273.2,307.7L275.6,313.5L279,309.4L285.3,306.4L292.4,302.7L296.9,292.1L304.2,285L306.2,278.4L307.4,278.4L310.9,268.3L320.1,238.4L313,237.4L308.4,232.4L306.3,224.2L310.1,206L312.6,180.5L308.4,156.2L301.6,136.9L289.8,121.3L281.3,107.2L248.7,70.1ZM108.7,430.8L96.5,431.6L82.7,433.9L69.3,438.3L63.9,444L59.2,448L60.8,455.8L66.2,459.4L71,456.2L85.5,456.3L94.7,454.1L107.4,451L110.6,449.5L112.6,445.5L117.6,441L117.1,439.4L118.7,438.3L117.1,438.3L114.5,434L108.7,430.8ZM254.9,320.7L255,316.4L253.3,314.5L252.6,318.2L246.3,321.9L248.9,325.2L245.4,324.7L240.5,324.7L237.3,326.5L237.9,330.1L241.1,331.4L245.7,330.1L244.7,333.6L242.3,335.2L245.7,335.5L245.7,338.3L245.8,340.3L252,337.3L250.2,335.3L252.9,332.8L256.3,333.6L254.7,329.6L256.7,328.4L255.7,326.4L255.7,322.2ZM195.4,330.9L192.6,329.4L193.7,325.9L193.9,322.9L190.7,322.3L188.6,325.3L187,326L186.2,330.2L189.1,339.1L192,339.8L193.4,336.1L196.6,339.3L200,340.1L203.5,340.9L203.8,338.2L204.1,335.3L205,332.6L201.5,331.2L196.3,332.3ZM69.7,353.6L67,351.2L63.9,351.3L66,354.8L62.8,354.4L61.3,356L59.3,357.6L54.3,361.6L54.9,364.2L57.4,366.3L56.5,368L61.5,367.7L69.2,362.6L71.2,364.2L74.1,360.2L74.6,356.7L70.2,353.9ZM76.5,200.3L74.9,199.2L75,197.8L74.7,195.8L73.9,192.5L73.1,190.1L69.6,192.2L71,199.1L71.8,201.3L72,202.4L74.4,202.9L73.4,205.7L78.6,206L76.6,201.9ZM86.1,109.9L86,107.8L85.8,103.7L85.5,99.9L81.6,96.8L78.1,94.1L74.1,96.4L73.6,101.8L76.9,107.1L76.8,108.6L75.4,111.1L81.6,111.1L83.4,112L85.2,111.5ZM89.7,119.5L88.1,118.3L85.9,117.8L83.9,117.4L81.8,119.8L77.6,120L73.5,121.7L72.7,122.4L73.8,123.5L73.5,124.3L75.6,124L76.3,124.5L76.3,124.9L77.4,124.9L78.7,125.9L82.8,123.9L84.4,122.5L87.6,121.6L89.2,121L89.7,119.5ZM59.9,309L58.1,309L58.4,311.3L59.6,312.2L61,312.6L63.4,313.4L63.7,314.5L65,315.1L65.5,315.2L65.6,313.8L65,312.7L63.8,312.1L62.2,311.1L62.5,310.3L63.7,309.9L62.7,309.5L62,308.9L59.9,309ZM73,328.3L70.5,327.8L69.9,326.9L71.2,325.8L71.9,325.3L69.6,323.9L67.4,324L68.3,325.5L67.9,326.5L66.9,327.1L64.8,328.1L63.1,328.6L64.5,329.4L66.7,328.8L71.4,329.6L71.4,330.4L71.7,331.1L73,328.3ZM228.4,331.1L226.3,330.1L224.8,330.9L225.5,331.4L227.7,331.6L228.3,332.7L227.9,333.4L229.2,334.1L229.6,334.6L230.5,335.8L232.9,334.5L231.6,333.9L231.9,333.6L233,333.4L233.1,332.4L232.2,330.7L228.9,331.3Z'

const DISTRICT_LINES = [
  'M99 101C145 118 222 96 289 125',
  'M81 170C143 184 230 164 310 192',
  'M86 240C148 226 228 249 301 260',
  'M76 302C142 284 213 311 279 307',
  'M112 67C132 142 111 214 112 285C113 317 127 343 143 359',
  'M202 55C187 128 205 202 193 274C189 300 181 320 174 342',
  'M261 81C242 139 251 215 271 281',
]

function RegionGauge() {
  const circumference = 2 * Math.PI * 24
  const dashOffset = circumference * 0.26

  return (
    <div className="relative grid h-[68px] w-[68px] shrink-0 place-items-center">
      <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(148,163,184,.16)" strokeWidth="5" />
        <motion.circle
          cx="30"
          cy="30"
          r="24"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.1, delay: 1, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#60A5FA" />
            <stop offset="1" stopColor="#5EEAD4" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-sm font-extrabold text-white">74</span>
    </div>
  )
}

function RegionCard() {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 22 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, delay: 0.85, ease: 'easeOut' }}
      className="relative z-20 mt-2 w-full rounded-2xl border border-blue-400/20 bg-[#101A30]/90 p-4 shadow-[0_22px_56px_rgba(0,0,0,.35)] backdrop-blur-xl md:absolute md:bottom-[11%] md:right-0 md:mt-0 md:w-[230px] xl:right-2"
    >
      <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-400">
        <MapPin size={13} /> Selected region
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold tracking-[-.03em] text-white">광주광역시</p>
          <p className="mt-2 text-[10px] font-semibold text-slate-400">관광 활성화 지수</p>
          <p className="mt-0.5 text-xs font-bold text-emerald-300">AI 분석 완료</p>
        </div>
        <RegionGauge />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/[.07] pt-3">
        <span className="text-[10px] text-slate-500">실시간 관광 데이터 연동</span>
        <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2 py-1 text-[9px] font-extrabold tracking-wide text-emerald-300">
          LIVE DATA
        </span>
      </div>
    </motion.aside>
  )
}

export function KoreaDataMap() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.75, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto w-full max-w-[610px]"
      aria-label="대한민국 관광 데이터 지도. 광주광역시가 선택되어 있습니다."
    >
      <div className="relative flex min-h-[400px] items-center justify-center sm:min-h-[470px] lg:min-h-[570px]">
        <div className="absolute left-1/2 top-1/2 h-[92%] max-h-[500px] w-[92%] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[.06]" />
        <div className="absolute left-1/2 top-1/2 h-[70%] max-h-[390px] w-[70%] max-w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-blue-300/10" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
          className="absolute left-1/2 top-1/2 h-[82%] max-h-[455px] w-[82%] max-w-[455px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[.05]"
        >
          <span className="absolute left-1/2 top-[-4px] h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_18px_#60a5fa]" />
          <span className="absolute bottom-[14%] right-[5%] h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_14px_#5eead4]" />
        </motion.div>

        <div className="absolute left-3 top-3 z-20 rounded-full border border-white/10 bg-white/[.055] px-3 py-1.5 text-[10px] font-bold tracking-[-.01em] text-slate-300 backdrop-blur-md sm:left-6 sm:top-6">
          대한민국 관광 데이터
        </div>

        <svg viewBox="0 0 360 510" className="relative z-10 h-[380px] w-[270px] overflow-visible drop-shadow-[0_24px_44px_rgba(0,0,0,.32)] sm:h-[455px] sm:w-[320px] lg:h-[520px] lg:w-[360px]">
          <defs>
            <linearGradient id="koreaFill" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#334155" stopOpacity=".92" />
              <stop offset=".55" stopColor="#202C40" stopOpacity=".96" />
              <stop offset="1" stopColor="#162033" />
            </linearGradient>
            <radialGradient id="gwangjuArea">
              <stop stopColor="#5EEAD4" stopOpacity=".42" />
              <stop offset=".55" stopColor="#3B82F6" stopOpacity=".2" />
              <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
            </radialGradient>
            <filter id="gwangjuGlow" x="-300%" y="-300%" width="700%" height="700%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="koreaClip"><path d={KOREA_OUTLINE} /></clipPath>
          </defs>

          <motion.path
            d={KOREA_OUTLINE}
            fill="url(#koreaFill)"
            stroke="#526078"
            strokeWidth="1.6"
            strokeLinejoin="round"
            initial={{ pathLength: 0, fillOpacity: 0 }}
            animate={{ pathLength: 1, fillOpacity: 1 }}
            transition={{ pathLength: { duration: 1.2, delay: 0.45 }, fillOpacity: { duration: 0.7, delay: 0.35 } }}
          />

          <g clipPath="url(#koreaClip)" fill="none" stroke="#94A3B8" strokeOpacity=".22" strokeWidth="1">
            {DISTRICT_LINES.map((line) => <path key={line} d={line} />)}
          </g>

          <path d="M111 304C174 303 217 326 270 348" fill="none" stroke="#60A5FA" strokeOpacity=".3" strokeDasharray="4 5" />
          <circle cx="111" cy="304" r="34" fill="url(#gwangjuArea)" />
          <motion.circle
            cx="111"
            cy="304"
            r="18"
            fill="none"
            stroke="#60A5FA"
            strokeWidth="1.5"
            animate={{ r: [14, 29], opacity: [0.9, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.g
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.9, type: 'spring', stiffness: 190, damping: 14 }}
            style={{ transformOrigin: '111px 304px' }}
          >
            <circle cx="111" cy="304" r="9" fill="#2563EB" stroke="#F8FAFC" strokeWidth="3" filter="url(#gwangjuGlow)" />
            <circle cx="111" cy="304" r="2.5" fill="#5EEAD4" />
          </motion.g>

          <g fill="#60A5FA">
            <circle cx="47" cy="205" r="2" opacity=".65" />
            <circle cx="313" cy="152" r="2.5" opacity=".55" />
            <circle cx="290" cy="381" r="2" opacity=".5" />
          </g>
        </svg>
      </div>
      <RegionCard />
    </motion.div>
  )
}
