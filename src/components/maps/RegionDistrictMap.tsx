import { useEffect, useMemo, useState } from 'react'
import { geoArea, geoMercator, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry, Feature } from 'geojson'
import { districtsForRegion, type DistrictId } from '@/data/tourismRegions'

interface Properties { name: string; districtId: DistrictId | null }
type MapData = FeatureCollection<Geometry, Properties> & { source: string; sourceYear: string; sourceUrl: string }

export function RegionDistrictMap({ regionId, regionName, selectedDistrict, onSelectDistrict }: {
  regionId: string; regionName: string; selectedDistrict: string | null; onSelectDistrict: (district: DistrictId) => void
}) {
  const [result, setResult] = useState<{ regionId: string; data?: MapData; error?: string } | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const current = result?.regionId === regionId ? result : null
  const data = current?.data
  const districts = useMemo(() => districtsForRegion(regionId), [regionId])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    fetch(`/maps/${encodeURIComponent(regionId)}.json`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('지도를 불러오지 못했습니다. 다시 시도해 주세요.')
      const payload = await response.json() as MapData
      if (payload.type !== 'FeatureCollection' || !payload.features.length) throw new Error('지도 경계 정보를 확인하지 못했습니다.')
      if (active) setResult({ regionId, data: payload })
    }).catch((error: unknown) => { if (active) setResult({ regionId, error: error instanceof Error ? error.message : '지도 조회 실패' }) })
    return () => { active = false; controller.abort() }
  }, [regionId, retry])
  const path = useMemo(() => data ? geoPath(geoMercator().fitExtent([[32, 65], [768, 525]], data)) : null, [data])
  const matched = new Set(data?.features.map(feature => feature.properties.districtId))
  const missing = districts.filter(district => !matched.has(district.id))
  // 섬이 여러 개인 지역은 가장 큰 육지에 이름을 배치합니다.
  const labelPoint = (feature: Feature<Geometry, Properties>) => {
    if (feature.geometry.type !== 'MultiPolygon') return path!.centroid(feature)
    const polygons = feature.geometry.coordinates.map(coordinates => ({ type: 'Polygon' as const, coordinates }))
    return path!.centroid(polygons.sort((a, b) => geoArea(b) - geoArea(a))[0])
  }
  return <div>
    <div className="relative aspect-[800/590] w-full">
      <div className="absolute inset-[8%] rounded-full border border-white/[.06] bg-[#172945]/30" />
      <p className="absolute left-4 top-2 z-10 rounded-full border border-[#F4C57A]/20 bg-[#0B1528]/85 px-3 py-2 text-[10px] font-bold text-[#FFD89A]">{regionName} · {districts.length}개 시군구</p>
      {!current && <p role="status" className="absolute inset-0 grid place-items-center text-sm text-slate-300">시군구 지도를 불러오고 있습니다.</p>}
      {current?.error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-sm text-slate-300"><p>{current.error}</p><button onClick={() => { setResult(null); setRetry(value => value + 1) }} className="min-h-11 underline">다시 시도</button></div>}
      {data && path && <svg viewBox="0 0 800 590" className="absolute inset-0 h-full w-full" aria-label={`${regionName} 시군구 선택 지도`}>
        <g strokeLinejoin="round">{data.features.map((feature, index) => {
          const id = feature.properties.districtId
          const selectable = id && districts.some(district => district.id === id)
          const active = selectedDistrict === id && Boolean(id)
          return <path key={`${id}-${index}`} d={path(feature) ?? ''} role={selectable ? 'button' : undefined} tabIndex={selectable ? 0 : undefined}
            aria-label={selectable ? `${feature.properties.name} 선택` : `${feature.properties.name} 이전 경계`} aria-pressed={selectable ? active : undefined}
            fill={active ? '#D8AA64' : hovered === feature.properties.name ? '#334B6B' : selectable ? '#182A44' : '#101B2C'} stroke={active || hovered === feature.properties.name ? '#F4C57A' : '#657895'} strokeWidth={active ? 2.8 : 1.6}
            className={selectable ? 'cursor-pointer outline-none transition-colors hover:fill-[#334B6B] focus:fill-[#334B6B] focus:stroke-[#F4C57A]' : 'opacity-40'}
            onMouseEnter={() => setHovered(feature.properties.name)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(feature.properties.name)} onBlur={() => setHovered(null)}
            onClick={() => { if (selectable) onSelectDistrict(id) }} onKeyDown={event => { if (selectable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelectDistrict(id) } }}>
            <title>{feature.properties.name}{selectable ? ' 선택' : ' · 이전 경계'}</title>
          </path>
        })}</g>
        <g pointerEvents="none" textAnchor="middle" dominantBaseline="middle">{data.features.map((feature, index) => {
          if (!feature.properties.districtId) return null
          const [x, y] = labelPoint(feature)
          return <text key={index} x={x} y={y} fill="#F1F5F9" stroke="#0A1628" strokeWidth="3" paintOrder="stroke" fontSize={data.features.length > 30 ? 10 : 12} fontWeight="700">{feature.properties.name}</text>
        })}</g>
      </svg>}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#0B1528]/90 px-4 py-2 text-[10px] text-slate-300">{hovered ? `${hovered} · 선택하면 지역 현황으로 이동` : '시군구 모양을 클릭해 지역 현황으로 이동'}</p>
    </div>
    {data && <p className="px-4 text-[10px] leading-5 text-slate-400"><a href={data.sourceUrl} target="_blank" rel="noreferrer" className="underline">{data.source} · {data.sourceYear} 경계 기반</a>{missing.length > 0 && ' · 일부 개편 지역은 경계 정보가 연결되지 않아 선택할 수 없습니다.'}</p>}
  </div>
}
