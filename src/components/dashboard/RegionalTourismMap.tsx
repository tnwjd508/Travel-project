import { useEffect, useMemo, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import { useDashboardRegion } from '@/hooks/useDashboardRegion'
import { useDistrictResource } from '@/hooks/useDistrictResource'
import { requireTourismDistrict } from '@/data/tourismRegions'
import { Card } from '@/components/ui/Card'
import { DataNotice, SourceNote } from './DataNotice'

type Boundaries = FeatureCollection<Geometry, { districtId: string | null; name: string }>

// main의 관광 지도와 같은 콘텐츠 API를 이용하며 광주 경계를 다른 지역에 표시하지 않습니다.
export function RegionalTourismMap() {
  const region = useDashboardRegion()
  const state = useDistrictResource('contents', { district: region.slug })
  const [boundaries, setBoundaries] = useState<Boundaries | null>(null)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    fetch(`/maps/${encodeURIComponent(region.regionId)}.json`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('경계 조회 실패')
        const data = await response.json() as Boundaries
        if (!controller.signal.aborted) setBoundaries(data)
      }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [region.regionId, attempt])
  const districtId = requireTourismDistrict(region.slug, region.regionId).id
  const geometry = useMemo(() => {
    const feature = boundaries?.features.find(item => item.properties.districtId === districtId)
    if (!feature) return null
    const projection = geoMercator().fitExtent([[30, 30], [730, 470]], feature)
    return { feature, projection, path: geoPath(projection) }
  }, [boundaries, districtId])
  const items = state.data?.items ?? []
  const current = items.find(item => item.contentId === selected)
  return <Card className="p-6">
    <h3 className="text-lg font-bold">{region.nameKo} 관광지 공간 분포</h3>
    <p className="mb-4 mt-2 text-xs text-slate-500">관광지 위치를 선택하면 이름과 주소를 확인할 수 있습니다.</p>
    <DataNotice state={state} />
    <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
      <div className="rounded-2xl bg-slate-50">
        {geometry ? <svg viewBox="0 0 760 500" className="w-full" aria-label={`${region.regionName} ${region.nameKo} 관광 지도`}>
          <path d={geometry.path(geometry.feature) ?? ''} fill="#DBEAFE" stroke="#93C5FD" strokeWidth="2" />
          {items.filter(item => item.lng !== null && item.lat !== null).map(item => {
            const point = geometry.projection([item.lng!, item.lat!])
            if (!point || point.some(value => !Number.isFinite(value))) return null
            return <circle key={item.contentId} cx={point[0]} cy={point[1]} r={selected === item.contentId ? 8 : 5}
              fill={selected === item.contentId ? '#F59E0B' : '#2563EB'} stroke="white" strokeWidth="2"
              role="button" tabIndex={0} aria-label={item.title} className="cursor-pointer focus:stroke-slate-900"
              onClick={() => setSelected(item.contentId)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(item.contentId) } }}>
              <title>{item.title}</title>
            </circle>
          })}
        </svg> : <p className="p-8 text-sm text-slate-500">{error ? '지도 경계를 불러오지 못했습니다.' : boundaries ? '이 지역의 경계 정보가 아직 연결되지 않았습니다.' : '지도를 불러오고 있습니다.'}{error && <button className="ml-2 underline" onClick={() => setAttempt(value => value + 1)}>다시 시도</button>}</p>}
      </div>
      <div>
        {current && <div className="mb-4 rounded-xl bg-blue-50 p-4"><h4 className="font-bold">{current.title}</h4><p className="mt-2 text-xs text-slate-600">{current.addr || '주소 정보 없음'}</p></div>}
        <div className="max-h-96 space-y-2 overflow-y-auto">{items.map(item => <button key={item.contentId} onClick={() => setSelected(item.contentId)} className="block w-full rounded-xl border border-slate-200 p-3 text-left text-xs hover:bg-blue-50">{item.title}</button>)}</div>
        {state.status === 'live' && !items.length && <p className="text-xs text-slate-500">등록된 관광지가 없습니다.</p>}
      </div>
    </div>
    {state.data && <SourceNote data={state.data} />}
  </Card>
}
