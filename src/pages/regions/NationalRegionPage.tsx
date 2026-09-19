import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import { RegionMonthlyBriefing } from '@/components/dashboard/MonthlyBriefing'
import { regionQuery, type RegionSelection, type TourismDistrict, type TourismProvince } from '@/data/tourismRegions'
import type { ContentsResponse } from '@/types/district'

interface Catalogue { updatedAt: string; provinces: TourismProvince[]; districts: TourismDistrict[] }

function RegionContents({ selection }: { selection: RegionSelection }) {
  const key = `${selection.regionId}:${selection.district}`
  const [result, setResult] = useState<{ key: string; data?: ContentsResponse; error?: string } | null>(null)
  const [retry, setRetry] = useState(0)
  const current = result?.key === `${key}:${retry}` ? result : null
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    fetch(`/api/district/contents?${regionQuery(selection)}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json() as ContentsResponse & { message?: string }
        if (!response.ok) throw new Error('관광 정보를 불러오지 못했습니다.')
        if (data.district !== selection.district || !Array.isArray(data.items)) throw new Error('지역 정보 응답을 확인해 주세요.')
        if (active) setResult({ key: `${key}:${retry}`, data })
      })
      .catch((error: unknown) => {
        if (active) setResult({ key: `${key}:${retry}`, error: error instanceof Error ? error.message : '관광 정보 조회에 실패했습니다.' })
      })
    // 이전 지역의 느린 응답이 새 지역 화면에 나타나지 않도록 취소합니다.
    return () => { active = false; controller.abort() }
  }, [selection.regionId, selection.district, key, retry])
  return <section className="rounded-3xl border border-slate-200 bg-white p-6" aria-labelledby="contents-title">
    <h2 id="contents-title" className="text-lg font-bold text-slate-900">지역 관광 정보</h2>
    {!current && <p role="status" className="mt-4 text-sm text-slate-500">선택한 지역의 관광 정보를 불러오고 있습니다.</p>}
    {current?.error && <div role="alert" className="mt-4 text-sm text-amber-800"><p>{current.error}</p><button className="mt-2 min-h-11 underline" onClick={() => setRetry(value => value + 1)}>다시 시도</button></div>}
    {current?.data && <>
      <p className="mt-2 text-xs text-slate-500">등록된 관광 정보 {current.data.totalCount.toLocaleString()}개 · 최대 12개 표시</p>
      {!current.data.items.length && <p className="mt-4 text-sm text-slate-500">이 지역에서 제공되는 관광 정보를 확인하지 못했습니다.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{current.data.items.slice(0, 12).map(item => <article key={item.contentId} className="rounded-2xl bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{item.addr || '주소 정보 없음'}</p>
      </article>)}</div>
      <p className="mt-4 text-[11px] text-slate-400">{current.data.source} · 조회 시점의 등록 정보</p>
    </>}
  </section>
}

export function NationalRegionPage() {
  const { regionId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    fetch('/api/regions', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('지역 목록을 불러오지 못했습니다.')
      const data = await response.json() as Catalogue
      if (!Array.isArray(data.provinces) || !Array.isArray(data.districts)) throw new Error('지역 목록 형식을 확인해 주세요.')
      if (active) { setCatalogue(data); setError(null) }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : '지역 목록 조회에 실패했습니다.') })
    return () => { active = false; controller.abort() }
  }, [retry])
  const province = catalogue?.provinces.find(item => item.id === regionId)
  const districts = catalogue?.districts.filter(item => item.regionId === province?.id) ?? []
  const requestedDistrict = params.get('district') ?? ''
  const district = districts.find(item => item.id === requestedDistrict)
  const selection = province && district ? { regionId: province.id, district: district.id } : null

  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} />지역 지도로 돌아가기</Link>
      <header><p className="text-xs font-semibold tracking-widest text-blue-600">ONGIL · 지역 관광</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">전국 지역 브리핑</h1><p className="mt-3 text-sm leading-6 text-slate-500">시도와 시군구를 선택하면 해당 지역의 관광 정보와 월간 브리핑을 확인할 수 있습니다.</p></header>
      {error && <div role="alert" className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">{error}<button onClick={() => setRetry(value => value + 1)} className="ml-3 min-h-11 underline">다시 시도</button></div>}
      {!catalogue && !error && <p role="status">지역 목록을 불러오고 있습니다.</p>}
      {catalogue && <>
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">시도
            <select aria-label="시도" value={province?.id ?? ''} onChange={event => navigate(event.target.value ? `/regions/${event.target.value}` : '/regions')} className="mt-2 block min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 focus:ring-2 focus:ring-blue-500">
              <option value="">시도를 선택해 주세요</option>{catalogue.provinces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">시군구
            <select aria-label="시군구" disabled={!province} value={district?.id ?? ''} onChange={event => setParams(event.target.value ? { district: event.target.value } : {})} className="mt-2 block min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 disabled:bg-slate-50 focus:ring-2 focus:ring-blue-500">
              <option value="">시군구를 선택해 주세요</option>{districts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        {((regionId && !province) || (requestedDistrict && !district)) && <p role="alert" className="text-sm text-amber-800">주소에 포함된 지역 정보가 올바르지 않습니다. 시도와 시군구를 다시 선택해 주세요.</p>}
        {selection && district ? <>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><MapPin size={16} />{province?.name} · {district.name}</p>
          <RegionMonthlyBriefing selection={selection} districtName={district.name} />
          <RegionContents selection={selection} />
        </> : <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">조회할 시도와 시군구를 선택해 주세요.</div>}
        <p className="text-xs text-slate-400">한국관광공사 제공 지역 목록 · {catalogue.provinces.length}개 시도, {catalogue.districts.length}개 시군구 항목 · {catalogue.updatedAt.slice(0, 10)} 갱신</p>
      </>}
    </div>
  </main>
}
