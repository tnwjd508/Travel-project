import { useEffect, useState } from 'react'
import { CalendarDays, Check, MapPin, RefreshCw, Sparkles } from 'lucide-react'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import type { BriefingFestival, BriefingFinding, MonthlyBriefingData } from '@/types/briefing'
import { regionQuery, type RegionSelection } from '@/data/tourismRegions'

function completedMonths() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return Array.from({ length: 24 }, (_, index) => {
    const date = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
    date.setUTCMonth(date.getUTCMonth() - index - 1)
    return date.toISOString().slice(0, 7)
  })
}

function FestivalList({ title, festivals, failed }: { title: string; festivals: BriefingFestival[]; failed: boolean }) {
  return <div>
    <h3 className="text-xs font-bold text-slate-900">{title}</h3>
    <div className="mt-3 space-y-2">
      {festivals.map((festival) => <article key={festival.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h4 className="text-xs font-bold leading-5 text-slate-900">{festival.title}</h4>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-violet-700"><CalendarDays size={13} aria-hidden="true" />{festival.startDate} ~ {festival.endDate}</p>
        {festival.address && <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-5 text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" />{festival.address}</p>}
      </article>)}
      {/* API의 빈 응답은 실제 축제가 없다는 뜻이 아니므로 정보 제공 범위를 명확히 안내합니다. */}
      {!festivals.length && <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
        <p>{failed ? '축제 정보를 불러오지 못했습니다.' : '조회 조건에 맞는 축제 정보를 확인하지 못했습니다.'}</p>
        {!failed && <p className="mt-2 text-[11px] text-slate-400">실제 축제 개최 여부와 일정은 지자체 공지를 확인해 주세요.</p>}
      </div>}
    </div>
  </div>
}

function Finding({ finding, recommendation = false }: { finding: BriefingFinding; recommendation?: boolean }) {
  return <article className={`rounded-xl p-4 ${recommendation ? 'bg-orange-50 ring-1 ring-orange-100' : 'bg-blue-50/60'}`}>
    <h4 className="flex items-center gap-2 text-xs font-bold text-slate-900">{recommendation && <Check size={14} className="shrink-0 text-orange-600" aria-hidden="true" />}{finding.title}</h4>
    <p className="mt-2 text-xs leading-6 text-slate-600">{finding.description}</p>
  </article>
}

export function MonthlyBriefing() {
  const district = useActiveDistrict()
  return <RegionMonthlyBriefing selection={{ regionId: 'gwangju', district: district.slug }} districtName={district.nameKo} />
}

// 부모 화면이 받은 시도·시군구를 그대로 사용하므로 광주 외 지역에서도 재사용할 수 있습니다.
export function RegionMonthlyBriefing({ selection, districtName }: { selection: RegionSelection; districtName: string }) {
  const months = completedMonths()
  const [month, setMonth] = useState(months[0])
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: MonthlyBriefingData; error?: string } | null>(null)
  const requestKey = `${selection.regionId}:${selection.district}:${month}:${retry}`
  const current = result?.key === requestKey ? result : null
  const data = current?.data
  const loading = !current

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    // 지역이나 월을 바꾸면 이전 응답을 무시하여 다른 자치구의 진단이 섞이지 않게 합니다.
    const timer = window.setTimeout(() => controller.abort(), 260_000)
    const query = regionQuery(selection)
    query.set('month', month)
    fetch(`/api/monthly-briefing?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as MonthlyBriefingData
        if (!response.ok) throw new Error('월간 브리핑을 불러오지 못했습니다.')
        if (payload.district !== selection.district || payload.month !== month || !Array.isArray(payload.sources)) throw new Error('브리핑 응답을 확인할 수 없습니다.')
        if (active) setResult({ key: requestKey, data: payload })
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, error: controller.signal.aborted ? '브리핑 생성 시간이 초과되었습니다. 다시 시도해 주세요.' : '월간 브리핑을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' })
      })
      .finally(() => window.clearTimeout(timer))
    return () => { active = false; window.clearTimeout(timer); controller.abort() }
  }, [selection.regionId, selection.district, month, requestKey])

  const festivalSource = data?.sources.find((source) => source.id === 'festivals')
  const festivalIncomplete = festivalSource?.status === 'error' || festivalSource?.status === 'partial'

  return <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)] sm:p-7" aria-labelledby="briefing-title" aria-busy={loading}>
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Sparkles size={18} aria-hidden="true" /></span>
      <div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-blue-600">Monthly briefing</p><h2 id="briefing-title" className="mt-0.5 text-lg font-bold tracking-[-.03em] text-slate-950">{districtName} 월간 브리핑</h2></div>
      {data && <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${data.aiStatus === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{data.aiStatus === 'ready' ? '분석 완료' : data.aiStatus === 'partial' ? '일부 정보 기준' : '분석 이용 불가'}</span>}
      <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-500">진단 월
        <select value={month} onChange={(event) => setMonth(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          {months.map((value) => <option key={value} value={value}>{value.replace('-', '년 ')}월</option>)}
        </select>
      </label>
    </header>

    {loading && <div role="status" className="py-10 text-center"><RefreshCw size={22} className="mx-auto animate-spin text-blue-500" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-slate-700">관광 자료를 모아 월간 진단을 작성하고 있습니다.</p><p className="mt-2 text-xs text-slate-500">처음 조회하는 지역·월은 분석에 몇 분이 걸릴 수 있습니다.</p></div>}
    {current?.error && <div role="alert" className="mt-5 rounded-xl bg-amber-50 p-4"><p className="text-sm text-amber-900">{current.error}</p><button onClick={() => setRetry((value) => value + 1)} className="mt-3 min-h-11 rounded-lg bg-white px-4 text-xs font-bold text-blue-600 ring-1 ring-slate-200">다시 시도</button></div>}

    {data && <>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <h3 className="text-xs font-bold text-slate-900">{data.diagnosis ? '월간 AI 요약' : '월간 브리핑 안내'}</h3>
        <p className="mt-2 text-sm leading-7 text-slate-700">{data.diagnosis?.summary ?? '현재 AI 분석을 제공할 수 없습니다. 아래에서 지역 축제 정보를 확인해 주세요.'}</p>
        <p className="mt-2 text-[10px] leading-5 text-slate-500">{data.month} 기준</p>
      </div>
      <div className="grid gap-6 pt-6 lg:grid-cols-2">
        {data.diagnosis && <div className="order-1"><h3 className="text-xs font-bold text-slate-900">핵심 진단</h3><div className="mt-3 space-y-3">
          {data.diagnosis?.findings.map((finding, index) => <Finding key={index} finding={finding} />)}
        </div></div>}
        <div className="order-3 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:col-span-2">
          <FestivalList title="최근 종료된 축제" festivals={data.festivals.recent} failed={festivalIncomplete} />
          <FestivalList title="앞으로 열릴 축제" festivals={data.festivals.upcoming} failed={festivalIncomplete} />
          <p className="text-[10px] leading-5 text-slate-400 sm:col-span-2">{data.festivalAsOf} 기준 · 출처: 한국관광공사 · 예정 일정은 변경될 수 있습니다.{festivalIncomplete && ' 일부 축제 정보가 누락될 수 있습니다.'}</p>
        </div>
        {data.diagnosis && <div className="order-2"><h3 className="text-xs font-bold text-slate-900">AI 추천 검토사항</h3><div className="mt-3 space-y-3">
          {data.diagnosis?.recommendations.map((finding, index) => <Finding key={index} finding={finding} recommendation />)}
          {!data.diagnosis?.recommendations.length && <p className="text-xs leading-6 text-slate-500">현재 제공할 추천사항이 없습니다.</p>}
        </div></div>}
      </div>

    </>}
  </section>
}
