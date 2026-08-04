import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AmbientBackground } from '@/components/landing/AmbientBackground'
import { BrandHero } from '@/components/landing/BrandHero'
import { GlowingPath } from '@/components/landing/GlowingPath'
import { KoreaRegionMap } from '@/components/landing/KoreaRegionMap'
import { LandingTransition } from '@/components/landing/LandingTransition'
import { RegionSelector } from '@/components/landing/RegionSelector'
import { SelectedRegionCard } from '@/components/landing/SelectedRegionCard'
import { regions } from '@/data/regions'
import type { Region, RegionId } from '@/types/region'

export function LandingPage() {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<RegionId>('gwangju')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const navigationTimer = useRef<number | null>(null)

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedId) ?? regions[0],
    [selectedId],
  )

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current)
  }, [])

  const selectRegion = (region: Region) => {
    setSelectedId(region.id)
    setNotice(null)
  }

  const showUnavailableNotice = (region: Region) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    setNotice(`${region.nameKo}은 현재 데이터 연동 준비 중입니다.`)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3200)
  }

  const enterDashboard = (region: Region) => {
    if (!region.dashboardPath || isTransitioning) return
    setIsTransitioning(true)
    navigationTimer.current = window.setTimeout(() => navigate(region.dashboardPath!), 620)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050A18] text-[#F8F4EC] selection:bg-[#F4C57A]/25 selection:text-[#FFF9EE]">
      <AmbientBackground />
      <GlowingPath />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1580px] gap-6 px-5 pb-24 pt-6 sm:px-9 sm:pb-20 sm:pt-8 lg:grid-cols-[46%_54%] lg:items-center lg:gap-0 lg:px-12 lg:py-8 xl:px-16">
        <BrandHero />

        <section className="relative z-20 flex min-w-0 flex-col items-center lg:pl-4" aria-labelledby="region-map-title">
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .6, delay: .58 }} className="mb-2 flex w-full max-w-[600px] items-center justify-between gap-4 px-2">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[.22em] text-[#78849A]">Select your region</p>
              <h2 id="region-map-title" className="mt-1 text-sm font-semibold tracking-[-.02em] text-[#FFF9EE] sm:text-base">지역을 선택해 주세요</h2>
              <p className="mt-1 text-[10px] text-[#78849A] sm:text-[11px]">빛나는 길이 시작됩니다.</p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-white/[.08] bg-white/[.025] px-3 py-1.5 text-[9px] font-semibold text-[#AAB4C5] sm:flex"><MapPin size={11} className="text-[#F4C57A]" />6개 지역 탐색 가능</div>
          </motion.div>

          <KoreaRegionMap regions={regions} selectedId={selectedId} onSelect={selectRegion} />

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, delay: 1.15 }} className="relative z-30 -mt-2 w-full max-w-[610px] space-y-3 lg:-mt-7">
            <RegionSelector regions={regions} selectedId={selectedId} onSelect={selectRegion} />
            <SelectedRegionCard region={selectedRegion} onEnter={enterDashboard} onUnavailable={showUnavailableNotice} />
          </motion.div>
        </section>
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5 z-20 hidden items-center gap-4 text-[9px] text-[#78849A] sm:flex lg:right-10">
        <span>지도 데이터 © MapSVG · CC BY 4.0</span><span>AI 지역 관광전략 수립 플랫폼</span><span className="h-px w-8 bg-[#F4C57A]/35" /><strong className="text-xs font-medium tracking-[-.02em] text-[#D9C7AC]">ON<span className="text-[#F4C57A]">:</span>GIL</strong>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: 18, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 12, x: '-50%' }} role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-50 flex min-h-12 w-[calc(100%-32px)] max-w-md items-center gap-3 rounded-xl border border-white/[.1] bg-[#101A30]/95 px-4 py-3 text-xs text-[#D6DCE7] shadow-[0_18px_50px_rgba(0,0,0,.42)] backdrop-blur-xl">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-400/10 text-blue-300"><MapPin size={14} /></span>
            <span className="flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} className="grid h-8 w-8 place-items-center rounded-lg text-[#78849A] outline-none transition hover:bg-white/[.06] hover:text-white focus-visible:ring-2 focus-visible:ring-[#F4C57A]/70" aria-label="알림 닫기"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <LandingTransition active={isTransitioning} />
    </main>
  )
}
