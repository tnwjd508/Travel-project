import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { regions } from '@/data/regions'
import { getRegionTourismHero } from '@/services/tourApi'

const defaultHeroImage = '/images/gwangju-acc-hero.jpg'
const defaultHeroAlt = '국립아시아문화전당과 광주 도심의 저녁 풍경'

export function TourismHero() {
  const location = useLocation()
  const regionId = location.pathname.split('/')[2]
  const region = useMemo(
    () => regions.find((item) => item.id === regionId) ?? regions[0],
    [regionId],
  )
  const fallbackHeroImage = region.heroImage ?? defaultHeroImage
  const fallbackHeroAlt = region.heroAlt ?? defaultHeroAlt
  const [heroImage, setHeroImage] = useState(fallbackHeroImage)
  const [heroAlt, setHeroAlt] = useState(fallbackHeroAlt)

  useEffect(() => {
    let cancelled = false
    setHeroImage(fallbackHeroImage)
    setHeroAlt(fallbackHeroAlt)

    if (!region.tourApiAreaCode || !region.heroKeyword) {
      return () => { cancelled = true }
    }

    getRegionTourismHero(region.tourApiAreaCode, region.heroKeyword)
      .then(({ items }) => {
        if (cancelled) return
        const tourismImage = items.find((item) => item.firstimage)
        if (!tourismImage?.firstimage) return

        setHeroImage(tourismImage.firstimage.replace(/^http:\/\//i, 'https://'))
        setHeroAlt(tourismImage.title
          ? `${tourismImage.title} 관광 이미지`
          : `${region.nameKo} 대표 관광지 이미지`)
      })
      .catch(() => {
        if (!cancelled) {
          setHeroImage(fallbackHeroImage)
          setHeroAlt(fallbackHeroAlt)
        }
      })

    return () => { cancelled = true }
  }, [fallbackHeroAlt, fallbackHeroImage, region.heroKeyword, region.nameKo, region.tourApiAreaCode])

  return (
    <section className="relative min-h-[440px] overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-[0_8px_30px_rgba(15,23,42,.05)] sm:min-h-[380px] lg:min-h-[340px]" aria-labelledby="overview-title">
      <img
        src={heroImage}
        alt={heroAlt}
        className="absolute inset-0 h-full w-full object-cover object-[62%_70%] sm:left-auto sm:right-0 sm:w-[72%] sm:object-[58%_68%] lg:w-[68%]"
        style={{
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,.35) 22%, black 52%, black 100%)',
          maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,.35) 22%, black 52%, black 100%)',
        }}
        fetchPriority="high"
        onError={() => {
          if (heroImage !== fallbackHeroImage) {
            setHeroImage(fallbackHeroImage)
            setHeroAlt(fallbackHeroAlt)
          }
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/5 sm:via-white/90 sm:to-transparent lg:via-white/85" />
      <div className="absolute inset-0 bg-gradient-to-t from-white/55 via-transparent to-white/10 sm:from-transparent" />

      <div className="absolute right-4 top-4 z-10 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur-md sm:right-6 sm:top-6">
        데이터 업데이트 : 2025.11.23
      </div>

      <div className="relative z-10 flex min-h-[440px] max-w-[720px] flex-col justify-end px-6 py-7 sm:min-h-[380px] sm:justify-center sm:px-9 lg:min-h-[340px] lg:px-12">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50/90 px-3 py-1.5 text-[10px] font-semibold text-blue-700">
          <Sparkles size={13} aria-hidden="true" />
          AI가 분석한 {region.nameKo} 관광 현황
        </div>
        <h1 id="overview-title" className="mt-5 text-[32px] font-bold leading-[1.18] tracking-[-.045em] text-slate-950 sm:text-[39px] lg:text-[42px]">
          {region.nameKo}의 관광 미래를<br />
          <span className="text-blue-600">AI</span>가 함께 설계합니다.
        </h1>
        <p className="mt-4 text-sm font-medium leading-6 text-slate-600 sm:text-[15px]">
          데이터와 AI 분석으로 관광 현황을 진단하고,<br className="hidden sm:block" /> 최적의 정책 전략을 제안합니다.
        </p>
        <p className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          ON:GIL과 함께 미래 관광의 길을 열어보세요.
          <ArrowRight size={13} className="text-blue-600" aria-hidden="true" />
        </p>
      </div>
    </section>
  )
}
