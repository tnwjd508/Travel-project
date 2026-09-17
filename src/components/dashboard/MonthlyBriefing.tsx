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
        <p>{failed ? '축제 자료를 모두 수집하지 못해 목록을 확인할 수 없습니다.' : '조회 조건에 맞는 축제 정보를 확인하지 못했습니다.'}</p>
        {!failed && <p className="mt-2 text-[11px] text-slate-400">실제 축제 개최 여부와 일정은 지자체 공지를 확인해 주세요.</p>}
      </div>}
    </div>
  </div>
}

function Finding({ finding, data, recommendation = false }: { finding: BriefingFinding; data: MonthlyBriefingData; recommendation?: boolean }) {
  const labels = [...new Set(finding.evidenceIds.map((id) => data.evidence.find((item) => item.id === id)?.label).filter(Boolean))]
  return <article className={`rounded-xl p-4 ${recommendation ? 'bg-orange-50 ring-1 ring-orange-100' : 'bg-blue-50/60'}`}>
    <h4 className="flex items-center gap-2 text-xs font-bold text-slate-900">{recommendation && <Check size={14} className="shrink-0 text-orange-600" aria-hidden="true" />}{finding.title}</h4>
    <p className="mt-2 text-xs leading-6 text-slate-600">{finding.description}</p>
    <p className="mt-2 text-[10px] leading-5 text-slate-500">근거: {labels.join(' · ')}</p>
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
        const payload = await response.json() as MonthlyBriefingData & { message?: string }
        if (!response.ok) throw new Error(payload.message || '월간 브리핑을 불러오지 못했습니다.')
        if (payload.district !== selection.district || payload.month !== month || !Array.isArray(payload.sources)) throw new Error('브리핑 응답을 확인할 수 없습니다.')
        if (active) setResult({ key: requestKey, data: payload })
      })
      .catch((error: unknown) => {
        if (active) setResult({ key: requestKey, error: controller.signal.aborted ? '브리핑 생성 시간이 초과되었습니다. 다시 시도해 주세요.' : error instanceof Error ? error.message : '브리핑을 불러오지 못했습니다.' })
      })
      .finally(() => window.clearTimeout(timer))
    return () => { active = false; window.clearTimeout(timer); controller.abort() }
  }, [selection.regionId, selection.district, month, requestKey])

  const festivalSource = data?.sources.find((source) => source.id === 'festivals')
  const festivalIncomplete = festivalSource?.status === 'error' || festivalSource?.status === 'partial'
  const statusLabels = { ready: '수집 완료', empty: '자료 없음', partial: '부분 수집', error: '수집 실패' }

  return <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)] sm:p-7" aria-labelledby="briefing-title" aria-busy={loading}>
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Sparkles size={18} aria-hidden="true" /></span>
      <div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-blue-600">Monthly briefing</p><h2 id="briefing-title" className="mt-0.5 text-lg font-bold tracking-[-.03em] text-slate-950">{districtName} 월간 브리핑</h2></div>
      {data && <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${data.aiStatus === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{data.aiStatus === 'ready' ? 'Gemini 분석' : data.aiStatus === 'partial' ? 'AI 일부 분석' : '수집 근거만 표시'}</span>}
      <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-500">진단 월
        <select value={month} onChange={(event) => setMonth(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          {months.map((value) => <option key={value} value={value}>{value.replace('-', '년 ')}월</option>)}
        </select>
      </label>
    </header>

    {loading && <div role="status" className="py-10 text-center"><RefreshCw size={22} className="mx-auto animate-spin text-blue-500" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-slate-700">관광 자료를 모아 월간 진단을 작성하고 있습니다.</p><p className="mt-2 text-xs text-slate-500">처음 조회하는 지역·월은 API 수집과 단계별 분석에 몇 분이 걸릴 수 있습니다.</p></div>}
    {current?.error && <div role="alert" className="mt-5 rounded-xl bg-amber-50 p-4"><p className="text-sm text-amber-900">{current.error}</p><button onClick={() => setRetry((value) => value + 1)} className="mt-3 min-h-11 rounded-lg bg-white px-4 text-xs font-bold text-blue-600 ring-1 ring-slate-200">다시 시도</button></div>}

    {data && <>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <h3 className="text-xs font-bold text-slate-900">{data.diagnosis ? '월간 AI 요약' : '자료 수집 결과'}</h3>
        <p className="mt-2 text-sm leading-7 text-slate-700">{data.diagnosis?.summary ?? 'AI 진단이 생성되지 않았습니다. 아래에서 실제 수집된 근거와 축제 정보를 확인할 수 있습니다.'}</p>
        <p className="mt-2 text-[10px] leading-5 text-slate-500">{data.month} 통계 · {data.sources.filter((source) => source.status === 'ready').length}/{data.sources.length}개 API 수집 완료 · 생성 {new Date(data.generatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
      </div>
      <div className="grid gap-6 pt-6 lg:grid-cols-2">
        <div className="order-1"><h3 className="text-xs font-bold text-slate-900">핵심 진단</h3><div className="mt-3 space-y-3">
          {data.diagnosis?.findings.map((finding, index) => <Finding key={index} finding={finding} data={data} />)}
          {!data.diagnosis && <p className="text-xs leading-6 text-slate-500">확인되지 않은 진단이나 예상 효과를 표시하지 않습니다.</p>}
        </div></div>
        <div className="order-3 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:col-span-2">
          <FestivalList title="최근 종료된 축제" festivals={data.festivals.recent} failed={festivalIncomplete} />
          <FestivalList title="앞으로 열릴 축제" festivals={data.festivals.upcoming} failed={festivalIncomplete} />
          <p className="text-[10px] leading-5 text-slate-400 sm:col-span-2">{data.festivalAsOf} 한국 날짜 기준 · 최근 1년 종료 / 예정 시작 90일 · 각각 최대 3개 · 한국관광공사 TourAPI<br />최근 2년 시작 행사 조회. 예정 일정은 변경될 수 있습니다.{festivalIncomplete && ' 일부 수집으로 목록이 완전하지 않을 수 있습니다.'}</p>
        </div>
        <div className="order-2"><h3 className="text-xs font-bold text-slate-900">AI 추천 검토사항</h3><div className="mt-3 space-y-3">
          {data.diagnosis?.recommendations.map((finding, index) => <Finding key={index} finding={finding} data={data} recommendation />)}
          {!data.diagnosis?.recommendations.length && <p className="text-xs leading-6 text-slate-500">{data.diagnosis ? '제안을 작성할 근거가 충분하지 않습니다.' : 'AI 진단이 생성되면 수집 근거와 연결된 검토사항을 제공합니다.'}</p>}
        </div></div>
      </div>

      <details className="mt-6 border-t border-slate-100 pt-4">
        <summary className="cursor-pointer py-2 text-xs font-bold text-slate-700">수집 근거와 API 상태 보기 ({data.evidence.length}개 근거)</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{data.sources.map((source) => <div key={source.id} className="rounded-xl border border-slate-100 p-3 text-xs"><p className="font-semibold text-slate-800">{source.label} · {statusLabels[source.status]} · {source.count}행</p>{source.note && <p className="mt-1 leading-5 text-slate-500">{source.note}</p>}</div>)}</div>
        <dl className="mt-4 space-y-3">{data.evidence.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-800">{item.label}: {item.value}</dt><dd className="mt-1 text-[11px] leading-5 text-slate-500">{item.period} · {item.note}</dd></div>)}</dl>
      </details>
      {(data.warnings.length > 0 || Boolean(data.diagnosis?.limitations.length)) && <div className="mt-4 rounded-xl bg-amber-50/70 p-4 text-[11px] leading-6 text-amber-900"><p className="font-bold">자료와 해석의 한계</p><ul className="mt-1 list-disc space-y-1 pl-4">{[...data.warnings, ...(data.diagnosis?.limitations ?? [])].map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
    </>}
  </section>
}
