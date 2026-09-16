import { useEffect, useState } from 'react'
import { CalendarDays, MapPin } from 'lucide-react'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { getDistrictFestivals, type TourApiItem } from '@/services/tourApi'

const sigunguCodes = { donggu: 3, seogu: 5, namgu: 2, bukgu: 4, gwangsangu: 1 } as const

function koreaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()).replace(/-/g, '')
}

function dateLabel(value: string) {
  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`
}

export function OngoingFestivals() {
  const district = useActiveDistrict()
  const [festivals, setFestivals] = useState<TourApiItem[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const today = koreaDate()

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setFestivals([])

    // 올해 시작한 축제를 조회한 뒤 실제 행사 기간에 오늘이 포함되는지 확인합니다.
    const yearStart = `${today.slice(0, 4)}0101`
    getDistrictFestivals(sigunguCodes[district.slug], yearStart)
      .then(({ items }) => {
        if (cancelled) return
        setFestivals(items.filter((item) =>
          item.eventstartdate && item.eventenddate &&
          item.eventstartdate <= today && item.eventenddate >= today,
        ))
        setStatus('ready')
      })
      .catch(() => { if (!cancelled) setStatus('error') })

    return () => { cancelled = true }
  }, [district.slug, today])

  return (
    <section aria-labelledby="festivals-title">
      <h3 id="festivals-title" className="text-xs font-bold text-slate-900">{district.nameKo} 진행 중 축제</h3>

      {status === 'loading' && <p className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs leading-5 text-slate-500" role="status">축제 정보를 불러오는 중입니다.</p>}
      {status === 'error' && <p className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs leading-5 text-slate-500" role="status">축제 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>}
      {status === 'ready' && festivals.length === 0 && <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-6 text-slate-700">현재 등록된 진행 중 축제가 없습니다.</p>}
      {status === 'ready' && festivals.length > 0 && (
        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
          {festivals.map((festival) => (
            <article key={festival.contentid ?? `${festival.title}-${festival.eventstartdate}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-xs font-bold leading-5 text-slate-900">{festival.title}</h4>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-violet-700"><CalendarDays size={13} aria-hidden="true" />{dateLabel(festival.eventstartdate!)} – {dateLabel(festival.eventenddate!)}</p>
              {festival.addr1 && <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-5 text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" />{festival.addr1}</p>}
            </article>
          ))}
        </div>
      )}
      <p className="mt-3 text-[10px] font-medium text-slate-400">{dateLabel(today)} 기준 · 한국관광공사 TourAPI</p>
    </section>
  )
}
