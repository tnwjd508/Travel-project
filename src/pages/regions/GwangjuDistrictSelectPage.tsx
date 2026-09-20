import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, CircleDot, Compass, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GwangjuDistrictMap } from '@/components/maps/GwangjuDistrictMap'
import { DistrictSelectionCard } from '@/components/region/DistrictSelectionCard'
import { RegionBreadcrumb } from '@/components/region/RegionBreadcrumb'
import { getDistrictDashboardPath, getGwangjuDistrict, type DistrictSlug } from '@/data/gwangjuDistricts'
import { useTourismStrategyStore } from '@/stores/useTourismStrategyStore'

const progress = [
  { label: '광역 지역 선택', state: 'complete' },
  { label: '자치구 선택', state: 'current' },
  { label: 'AI 관광전략 분석', state: 'upcoming' },
] as const

export function GwangjuDistrictSelectPage() {
  const navigate = useNavigate()
  const timer = useRef<number | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictSlug | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const setSelectedProvince = useTourismStrategyStore((state) => state.setSelectedProvince)
  const saveSelectedDistrict = useTourismStrategyStore((state) => state.setSelectedDistrict)
  const district = useMemo(() => getGwangjuDistrict(selectedDistrict ?? undefined), [selectedDistrict])

  useEffect(() => {
    setSelectedProvince('gwangju')
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [setSelectedProvince])

  const selectDistrict = (slug: DistrictSlug) => {
    setSelectedDistrict(slug)
    saveSelectedDistrict(slug)
    confirmDistrict(slug)
  }

  const confirmDistrict = (slug: DistrictSlug) => {
    if (isLeaving) return
    saveSelectedDistrict(slug)
    setIsLeaving(true)
    timer.current = window.setTimeout(() => navigate(getDistrictDashboardPath(slug)), 360)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F5F8FC] text-slate-950">
      <div className="pointer-events-none absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-blue-100/55 blur-[110px]" />
      <div className="pointer-events-none absolute -right-48 bottom-0 h-[560px] w-[560px] rounded-full bg-indigo-100/50 blur-[120px]" />

      <header className="relative z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1540px] items-center gap-3 px-4 sm:px-7 lg:px-10">
          <button type="button" onClick={() => navigate('/')} className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="대한민국 지역 선택으로 돌아가기"><ArrowLeft size={19} /></button>
          <button type="button" onClick={() => navigate('/')} className="mr-auto rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <div className="flex items-center gap-2"><span className="text-xl font-extrabold tracking-[-.06em]">ON<span className="text-blue-600">:</span>GIL</span><span className="rounded-full bg-blue-50 px-2 py-1 text-[12px] font-extrabold text-blue-600">AI</span></div>
            <p className="hidden text-[12px] font-medium text-slate-400 sm:block">AI 지역 관광전략 수립 플랫폼</p>
          </button>
          <span className="hidden items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] font-bold text-blue-700 sm:flex"><Compass size={13} />광주광역시 자치구 탐색</span>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-7 sm:py-9 lg:px-10 lg:py-11">
        <RegionBreadcrumb />
        <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(300px,.34fr)_minmax(0,.66fr)] lg:items-start xl:gap-11">
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }} className="lg:sticky lg:top-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[12px] font-extrabold uppercase tracking-[.15em] text-blue-700"><Sparkles size={12} />Gwangju tourism map</span>
            <h1 className="mt-5 text-[34px] font-extrabold leading-[1.16] tracking-[-.055em] text-slate-950 sm:text-[42px] lg:text-[38px] xl:text-[46px]">
              광주광역시의<br /><span className="text-blue-600">관광 가능성</span>을<br />탐색하세요.
            </h1>
            <p className="mt-5 text-sm font-medium leading-7 text-slate-500">지도에서 자치구를 선택하면<br className="hidden lg:block" /> 지역별 관광 현황과 AI 관광전략을 확인할 수 있습니다.</p>

            <ol className="mt-7 space-y-2 rounded-[20px] border border-slate-200/80 bg-white/75 p-3 shadow-sm backdrop-blur" aria-label="지역 선택 진행 단계">
              {progress.map((item, index) => (
                <li key={item.label} aria-current={item.state === 'current' ? 'step' : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${item.state === 'current' ? 'bg-blue-50 text-blue-700' : 'text-slate-400'}`}>
                  <span className={`grid h-7 w-7 place-items-center rounded-full ${item.state === 'complete' ? 'bg-emerald-500 text-white' : item.state === 'current' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{item.state === 'complete' ? <Check size={13} /> : item.state === 'current' ? <CircleDot size={13} /> : index + 1}</span>
                  <span className="text-[12px] font-bold">{item.label}</span>
                  <span className="ml-auto text-[12px] font-bold">{item.state === 'complete' ? '완료' : item.state === 'current' ? '현재 단계' : '다음'}</span>
                </li>
              ))}
            </ol>

            <div className="mt-5">
              <AnimatePresence mode="wait">
                {district ? (
                  <DistrictSelectionCard district={district} onConfirm={() => confirmDistrict(district.slug)} />
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[20px] border border-dashed border-slate-300 bg-white/60 px-5 py-6 text-center">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Compass size={19} /></span>
                    <p className="mt-3 text-xs font-bold text-slate-700">지도에서 원하는 자치구를 선택해 주세요.</p>
                    <p className="mt-1 text-[12px] leading-5 text-slate-400">자치구 모양을 클릭하면 해당 지역 현황으로 이동합니다.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .58, delay: .12, ease: [0.16, 1, 0.3, 1] }} aria-labelledby="district-map-title">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
              <div><p className="text-[12px] font-bold uppercase tracking-[.16em] text-slate-400">Administrative districts</p><h2 id="district-map-title" className="mt-1 text-xl font-extrabold tracking-[-.035em] text-slate-900">광주 5개 자치구 선택 지도</h2></div>
              <p className="text-[12px] font-medium text-slate-400">동구 · 서구 · 남구 · 북구 · 광산구</p>
            </div>
            <GwangjuDistrictMap selectedDistrict={selectedDistrict} onSelectDistrict={selectDistrict} onConfirmDistrict={confirmDistrict} />
          </motion.section>
        </div>
      </div>

      <AnimatePresence>
        {isLeaving && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] grid place-items-center bg-blue-600/96 text-white" aria-live="polite"><motion.div initial={{ scale: .88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center"><motion.span animate={{ scale: [1, 1.55], opacity: [1, 0] }} transition={{ duration: .7, repeat: Infinity }} className="mx-auto block h-16 w-16 rounded-full border-2 border-white/70" /><p className="mt-5 text-sm font-bold">선택한 자치구의 관광전략을 불러오고 있습니다.</p></motion.div></motion.div>}
      </AnimatePresence>
    </main>
  )
}
