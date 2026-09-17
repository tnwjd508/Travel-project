import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, MapPin, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AmbientBackground } from '@/components/landing/AmbientBackground'
import { BrandHero } from '@/components/landing/BrandHero'
import { GlowingPath } from '@/components/landing/GlowingPath'
import { KoreaRegionMap } from '@/components/landing/KoreaRegionMap'
import { LandingTransition } from '@/components/landing/LandingTransition'
import { RegionSelector } from '@/components/landing/RegionSelector'
import { SelectedRegionCard } from '@/components/landing/SelectedRegionCard'
import { GwangjuDistrictMap } from '@/components/maps/GwangjuDistrictMap'
import { regions } from '@/data/regions'
import { getDistrictDashboardPath, getGwangjuDistrict, type DistrictSlug } from '@/data/gwangjuDistricts'
import { useTourismStrategyStore } from '@/stores/useTourismStrategyStore'
import type { Region, RegionId } from '@/types/region'

export function LandingPage() {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<RegionId>('gwangju')
  const [mapMode, setMapMode] = useState<'korea' | 'gwangju'>('korea')
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictSlug | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const navigationTimer = useRef<number | null>(null)
  const saveSelectedDistrict = useTourismStrategyStore((state) => state.setSelectedDistrict)

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedId) ?? regions[0],
    [selectedId],
  )
  const selectedDistrictInfo = useMemo(
    () => getGwangjuDistrict(selectedDistrict ?? undefined),
    [selectedDistrict],
  )

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current)
  }, [])

  const enterRegion = (region: Region) => {
    if (region.id === 'gwangju') {
      setMapMode('gwangju')
      setSelectedDistrict(null)
      return
    }
    if (!region.dashboardPath || isTransitioning) return
    setIsTransitioning(true)
    navigationTimer.current = window.setTimeout(() => navigate(region.dashboardPath!), 620)
  }

  const selectRegion = (region: Region) => {
    setSelectedId(region.id)
    setNotice(null)
    if (region.status === 'available') enterRegion(region)
  }

  const showUnavailableNotice = (region: Region) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    setNotice(`${region.nameKo}은 현재 데이터 연동 준비 중입니다.`)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3200)
  }

  const enterDistrict = (district: DistrictSlug) => {
    if (isTransitioning) return
    setSelectedDistrict(district)
    saveSelectedDistrict(district)
    setIsTransitioning(true)
    navigationTimer.current = window.setTimeout(() => navigate(getDistrictDashboardPath(district)), 520)
  }

  const showKoreaMap = () => {
    if (isTransitioning) return
    setMapMode('korea')
    setSelectedDistrict(null)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050A18] text-[#F8F4EC] selection:bg-[#F4C57A]/25 selection:text-[#FFF9EE]">
      <AmbientBackground />
      <GlowingPath />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1580px] gap-6 px-5 pb-24 pt-6 sm:px-9 sm:pb-20 sm:pt-8 lg:grid-cols-[46%_54%] lg:items-center lg:gap-0 lg:px-12 lg:py-8 xl:px-16">
        <BrandHero />

        <section className="relative z-20 flex min-w-0 flex-col items-center lg:pl-4" aria-labelledby="region-map-title">
          <button type="button" onClick={() => navigate('/regions')} className="mb-4 min-h-11 self-end rounded-full border border-white/20 px-4 text-xs font-semibold text-[#F4C57A] hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#F4C57A]">전국 시군구 브리핑 보기</button>
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .6, delay: .58 }} className="mb-2 flex w-full max-w-[600px] items-center justify-between gap-4 px-2">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[.22em] text-[#78849A]">{mapMode === 'korea' ? 'Select your region' : 'Select Gwangju district'}</p>
              <h2 id="region-map-title" className="mt-1 text-sm font-semibold tracking-[-.02em] text-[#FFF9EE] sm:text-base">{mapMode === 'korea' ? '지역을 선택해 주세요' : '광주광역시의 자치구를 선택해 주세요'}</h2>
              <p className="mt-1 text-[10px] text-[#78849A] sm:text-[11px]">{mapMode === 'korea' ? '빛나는 길이 시작됩니다.' : '구를 선택하면 지역 현황으로 이동합니다.'}</p>
            </div>
            {mapMode === 'korea' ? <div className="hidden items-center gap-2 rounded-full border border-white/[.08] bg-white/[.025] px-3 py-1.5 text-[9px] font-semibold text-[#AAB4C5] sm:flex"><MapPin size={11} className="text-[#F4C57A]" />6개 지역 탐색 가능</div> : <button type="button" onClick={showKoreaMap} className="flex min-h-10 items-center gap-2 rounded-full border border-white/[.08] bg-white/[.025] px-3 text-[9px] font-semibold text-[#AAB4C5] outline-none transition hover:border-[#F4C57A]/30 hover:text-[#FFF9EE] focus-visible:ring-2 focus-visible:ring-[#F4C57A]/70"><ArrowLeft size={12} />대한민국 지도</button>}
          </motion.div>

          <div className="relative w-full max-w-[650px]">
            <AnimatePresence mode="wait" initial={false}>
              {mapMode === 'korea' ? (
                <motion.div key="korea-map" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.06 }} transition={{ duration: .42, ease: [0.16, 1, 0.3, 1] }}>
                  <KoreaRegionMap regions={regions} selectedId={selectedId} onSelect={selectRegion} />
                </motion.div>
              ) : (
                <motion.div key="gwangju-map" initial={{ opacity: 0, scale: .82, rotate: -1 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: .9 }} transition={{ duration: .5, ease: [0.16, 1, 0.3, 1] }}>
                  <GwangjuDistrictMap variant="landing" selectedDistrict={selectedDistrict} onSelectDistrict={enterDistrict} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {mapMode === 'korea' ? (
              <motion.div key="region-controls" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: .4 }} className="relative z-30 -mt-2 w-full max-w-[610px] space-y-3 lg:-mt-7">
                <RegionSelector regions={regions} selectedId={selectedId} onSelect={selectRegion} />
                <SelectedRegionCard region={selectedRegion} onEnter={enterRegion} onUnavailable={showUnavailableNotice} />
              </motion.div>
            ) : (
              <motion.div key="district-controls" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="relative z-30 -mt-2 flex w-full max-w-[610px] items-center gap-3 rounded-2xl border border-white/[.1] bg-[#0B1528]/82 px-4 py-3 shadow-[0_20px_55px_rgba(0,0,0,.25)] backdrop-blur-xl lg:-mt-7">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#F4C57A]/20 bg-[#F4C57A]/10 text-[#FFD89A]"><Sparkles size={16} /></span>
                <div><p className="text-xs font-bold text-[#FFF9EE]">광주 5개 자치구</p><p className="mt-1 text-[10px] text-[#78849A]">지도에서 구 모양을 선택하면 기존 지역 현황 페이지로 이동합니다.</p></div>
                <button type="button" onClick={showKoreaMap} className="ml-auto hidden min-h-10 shrink-0 rounded-xl px-3 text-[10px] font-semibold text-[#AAB4C5] outline-none transition hover:bg-white/[.05] hover:text-white focus-visible:ring-2 focus-visible:ring-[#F4C57A]/70 sm:block">이전 지도</button>
              </motion.div>
            )}
          </AnimatePresence>
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

      <LandingTransition active={isTransitioning} label={selectedDistrictInfo ? `${selectedDistrictInfo.nameKo} 관광 현황을 여는 중` : undefined} />
    </main>
  )
}
