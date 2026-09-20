import { useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Layers3, LoaderCircle, MapPin, Minus, Navigation, Plus, RefreshCw } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { geoContains, geoMercator, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { Card } from '@/components/ui/Card'
import districtData from '@/assets/data/gwangju-districts.json'
import { STATIC_BOUNDARY_SOURCE_DATE } from '@/data/gwangjuNeighborhoods'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import type { GwangjuDistrict } from '@/data/gwangjuDistricts'
import { RegionalTourismMap } from './RegionalTourismMap'
import { useDistrictNeighborhoods } from '@/hooks/useDistrictNeighborhoods'
import type { NeighborhoodFeature } from '@/types/boundary'
import type { Attraction } from '@/types/tourism'
import { toD3FeatureCollection } from '@/utils/geoRendering'
import { useDistrictResource } from '@/hooks/useDistrictResource'
import { contentCategoryName } from '@/data/contentCategories'
import { DataNotice, SourceNote } from './DataNotice'

interface DistrictProperties {
  code: string
  name: string
}

type DistrictFeature = Feature<Geometry, DistrictProperties>

const districts = toD3FeatureCollection(districtData as FeatureCollection<Geometry, DistrictProperties>)

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 500
const VIEW_PADDING = 30
const ZOOM_LEVELS = [1, 1.25, 1.55, 1.9]
// viewBox 픽셀² 기준. 이보다 작은 동은 hover 나 선택 중일 때만 이름을 표시해 겹침을 줄인다.
const LABEL_MIN_AREA = 900
const neighborhoodFills = ['#BFDBFE', '#C7D2FE', '#BAE6FD', '#DDD6FE', '#CCFBF1', '#E0E7FF']

export function TourismMap() {
  const district = useActiveDistrict()
  // 광주의 상세 행정동 지도는 main 구현을 유지하고 다른 지역은 해당 시군구 경계를 씁니다.
  return district.legacy ? <GwangjuTourismMap key={district.slug} district={district.legacy} /> : <RegionalTourismMap key={`${district.regionId}/${district.slug}`} />
}

function GwangjuTourismMap({ district }: { district: GwangjuDistrict }) {
  const contentState = useDistrictResource('contents', { district: district.slug })
  const attractions = useMemo<Attraction[]>(() => (contentState.data?.items ?? []).filter(item => item.lng !== null && item.lat !== null).map(item => ({ id: item.contentId, name: item.title, category: contentCategoryName(item.category), lng: item.lng!, lat: item.lat!, visitors: '', accent: '#2563EB' })), [contentState.data])
  const { neighborhoods, source, status, errorMessage, retry } = useDistrictNeighborhoods(district)

  const [hovered, setHovered] = useState<NeighborhoodFeature | null>(null)
  const [selected, setSelected] = useState<NeighborhoodFeature | null>(null)
  const [tooltip, setTooltip] = useState({ x: 50, y: 50 })
  const [zoomIndex, setZoomIndex] = useState(0)
  const [showBoundaries, setShowBoundaries] = useState(true)
  const [activeAttraction, setActiveAttraction] = useState<Attraction | null>(null)

  const districtFeature = useMemo<DistrictFeature | null>(
    () => districts.features.find((feature) => feature.properties.code === district.code) ?? null,
    [district.code],
  )
  const contextDistricts = useMemo(
    () => districts.features.filter((feature) => feature.properties.code !== district.code),
    [district.code],
  )

  // 활성 자치구 경계에 투영을 맞춘다. 자치구가 바뀌면 지도가 그 자치구로 다시 맞춰진다.
  const { projection, path } = useMemo(() => {
    const fitProjection = geoMercator().fitExtent(
      [[VIEW_PADDING, VIEW_PADDING], [VIEW_WIDTH - VIEW_PADDING, VIEW_HEIGHT - VIEW_PADDING]],
      districtFeature ?? districts,
    )
    return { projection: fitProjection, path: geoPath(fitProjection) }
  }, [districtFeature])

  const shapes = useMemo(
    () => neighborhoods.map((feature, index) => ({
      feature,
      d: path(feature) ?? '',
      centroid: path.centroid(feature),
      area: path.area(feature),
      fill: neighborhoodFills[index % neighborhoodFills.length],
    })),
    [neighborhoods, path],
  )

  const districtAttractions = useMemo(
    () => (districtFeature ? attractions.filter((attraction) => geoContains(districtFeature, [attraction.lng, attraction.lat])) : []),
    [districtFeature, attractions],
  )

  useEffect(() => {
    setZoomIndex(0)
    setActiveAttraction(districtAttractions[0] ?? null)
  }, [district.code, districtAttractions])

  // 자치구가 바뀌거나 경계 출처(VWorld ↔ 정적)가 바뀌면 동 코드 체계가 달라지므로 선택을 비운다.
  useEffect(() => {
    setHovered(null)
    setSelected(null)
  }, [district.code, source])

  const zoom = ZOOM_LEVELS[zoomIndex]
  const zoomTransform = `translate(${VIEW_WIDTH / 2} ${VIEW_HEIGHT / 2}) scale(${zoom}) translate(${-VIEW_WIDTH / 2} ${-VIEW_HEIGHT / 2})`
  const boundaryKind = source === 'vworld' ? '법정동' : '행정동'
  const focusedArea = selected ?? hovered
  const districtOutline = districtFeature ? path(districtFeature) ?? undefined : undefined

  const statusTone = source === 'vworld' ? 'text-emerald-600' : status === 'loading' ? 'text-blue-500' : 'text-amber-600'
  const statusText = source === 'vworld'
    ? 'VWorld WFS 실시간 경계'
    : status === 'loading'
      ? 'VWorld 경계 연결 중 · 정적 지도 표시'
      : status === 'error'
        ? errorMessage || 'VWorld 연결 실패 · 정적 경계 표시'
        : status === 'disabled'
          ? 'VWorld 인증키 미설정 · 정적 경계 표시'
          : '정적 경계 데이터 표시'

  const updateTooltip = (event: PointerEvent<SVGPathElement>) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!bounds) return
    setTooltip({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    })
  }

  const toggleSelected = (feature: NeighborhoodFeature) => {
    setSelected((current) => (current?.properties.code === feature.properties.code ? null : feature))
  }

  const handleKeyDown = (event: KeyboardEvent<SVGPathElement>, feature: NeighborhoodFeature) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggleSelected(feature)
  }

  return (
    <Card className="grid min-h-[520px] overflow-hidden lg:grid-cols-[320px_1fr]">
      <aside className="z-10 border-b border-slate-100 bg-white/90 p-6 backdrop-blur lg:border-b-0 lg:border-r sm:p-7">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em] text-blue-600">
          <Navigation size={14} /> Tourism Map
        </div>
        <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900">{district.nameKo}를 {neighborhoods.length}개 {boundaryKind}으로<br />세밀하게 탐색하세요</h3>
        <p className="mt-3 text-xs leading-5 text-slate-400">지도 위 {boundaryKind}에 마우스를 올리거나 클릭해<br className="hidden lg:block" /> 경계와 이름을 확인할 수 있습니다.</p>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">Administrative areas</span>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-600">{district.nameKo} · {neighborhoods.length}개 동</span>
          </div>
          <div aria-label="행정구역 선택 정보" className="flex h-20 flex-col justify-center overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            {focusedArea ? (
              <>
                <p className="text-[9px] font-bold uppercase tracking-wider text-blue-600">{selected ? 'Selected' : 'Hovered'} {boundaryKind}</p>
                <p className="mt-0.5 truncate text-sm font-bold text-slate-800" title={focusedArea.properties.name}>{focusedArea.properties.name}</p>

              </>
            ) : (
              <p className="text-[11px] leading-5 text-slate-500">{district.nameKo}의 {boundaryKind} 경계가 표시됩니다. 동을 클릭하면 선택이 고정됩니다.</p>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">Tourism hotspots</span>
          {districtAttractions.length > 0 ? (
            <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
              {districtAttractions.map((attraction) => (
                <button
                  key={attraction.id ?? attraction.name}
                  type="button"
                  onMouseEnter={() => setActiveAttraction(attraction)}
                  onFocus={() => setActiveAttraction(attraction)}
                  onClick={() => setActiveAttraction(attraction)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${activeAttraction?.name === attraction.name ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-transparent bg-slate-50 hover:border-slate-200'}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: attraction.accent, boxShadow: `0 0 0 4px ${attraction.accent}18` }} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-xs text-slate-700">{attraction.name}</b>
                    <span className="text-[10px] text-slate-400">{attraction.category}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-5 text-slate-400">{district.nameKo}에 표시할 관광지 좌표가 없습니다.</p>
          )}
          <DataNotice state={contentState}/>
          {contentState.data && <SourceNote data={contentState.data}/>}
        </div>
      </aside>

      <div className="map-grid relative min-h-[460px] overflow-hidden bg-[#eef5f7]">
        <div className="absolute left-5 top-5 z-20 max-w-[300px] rounded-xl border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Administrative coverage</p>
            {status === 'loading' && <LoaderCircle size={12} className="animate-spin text-blue-500" aria-label="VWorld 연결 중" />}
            {status === 'error' && <button type="button" onClick={retry} className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600" aria-label="VWorld 경계 다시 불러오기"><RefreshCw size={11} /> 재시도</button>}
          </div>
          <p className="mt-0.5 text-xs font-bold text-slate-700">{source === 'vworld' ? 'VWorld 실시간' : `${STATIC_BOUNDARY_SOURCE_DATE} 기준`} <span className="text-blue-600">{district.nameKo} {neighborhoods.length}개 {boundaryKind}</span></p>
          <p className={`mt-1 text-[9px] font-semibold ${statusTone}`}>{statusText}</p>
        </div>

        <div className="absolute right-4 top-4 z-30 flex flex-col gap-2">
          <button type="button" aria-label="지도 확대" onClick={() => setZoomIndex((value) => Math.min(value + 1, ZOOM_LEVELS.length - 1))} disabled={zoomIndex === ZOOM_LEVELS.length - 1} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-500 shadow-md transition hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16} /></button>
          <button type="button" aria-label="지도 축소" onClick={() => setZoomIndex((value) => Math.max(value - 1, 0))} disabled={zoomIndex === 0} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-500 shadow-md transition hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"><Minus size={16} /></button>
          <button type="button" aria-label={`${boundaryKind} 경계 표시 전환`} aria-pressed={showBoundaries} onClick={() => setShowBoundaries((value) => !value)} className={`mt-2 grid h-9 w-9 place-items-center rounded-xl shadow-md transition ${showBoundaries ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}><Layers3 size={16} /></button>
        </div>

        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`광주광역시 ${district.nameKo} ${neighborhoods.length}개 ${boundaryKind} 지도`}
        >
          <defs>
            <filter id="tourism-map-district-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#64748B" floodOpacity=".2" />
            </filter>
          </defs>

          <g transform={zoomTransform}>
            <g fill="#E2E8F0" stroke="#FFFFFF" strokeWidth="1.5" opacity=".75" pointerEvents="none">
              {contextDistricts.map((feature) => (
                <path key={feature.properties.code} d={path(feature) ?? undefined}><title>{feature.properties.name}</title></path>
              ))}
            </g>

            {districtOutline && <path d={districtOutline} fill="#DBEAFE" filter="url(#tourism-map-district-shadow)" pointerEvents="none" />}

            <g strokeLinejoin="round">
              {shapes.map(({ feature, d, fill }, index) => {
                const code = feature.properties.code
                const isSelected = selected?.properties.code === code
                const isHovered = hovered?.properties.code === code
                return (
                  <motion.path
                    key={`${source}-${code}`}
                    d={d}
                    fill={isSelected ? '#2563EB' : isHovered ? '#60A5FA' : fill}
                    stroke={showBoundaries ? (isSelected ? '#1E3A8A' : '#FFFFFF') : 'none'}
                    strokeWidth={isSelected ? 2 : 1.1}
                    vectorEffect="non-scaling-stroke"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: .35, delay: Math.min(index * .02, .5) }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    aria-label={`${district.nameKo} ${feature.properties.name} 선택`}
                    onPointerEnter={() => setHovered(feature)}
                    onPointerMove={updateTooltip}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(feature)}
                    onBlur={() => setHovered(null)}
                    onClick={() => toggleSelected(feature)}
                    onKeyDown={(event) => handleKeyDown(event, feature)}
                    className="cursor-pointer outline-none transition-[fill] duration-150"
                  >
                    <title>{feature.properties.name}</title>
                  </motion.path>
                )
              })}
            </g>

            {districtOutline && <path d={districtOutline} fill="none" stroke="#1D4ED8" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />}

            <g pointerEvents="none" textAnchor="middle" dominantBaseline="middle" fontFamily="Pretendard, sans-serif" fontWeight="800" paintOrder="stroke" strokeLinejoin="round">
              {shapes.map(({ feature, centroid, area }) => {
                const code = feature.properties.code
                const emphasized = selected?.properties.code === code || hovered?.properties.code === code
                if (!emphasized && (!showBoundaries || area < LABEL_MIN_AREA)) return null
                return (
                  <text
                    key={`${source}-${code}-label`}
                    x={centroid[0]}
                    y={centroid[1]}
                    fontSize={emphasized ? 12 : 10}
                    fill={emphasized ? '#FFFFFF' : '#334155'}
                    stroke={emphasized ? '#1E3A8A' : '#F8FAFC'}
                    strokeWidth="3"
                  >
                    {feature.properties.name}
                  </text>
                )
              })}
            </g>

            {districtAttractions.map((attraction) => {
              const point = projection([attraction.lng, attraction.lat])
              if (!point) return null
              const active = activeAttraction?.name === attraction.name
              return (
                <motion.g
                  key={attraction.id ?? attraction.name}
                  transform={`translate(${point[0]} ${point[1]})`}
                  onMouseEnter={() => setActiveAttraction(attraction)}
                  onClick={() => setActiveAttraction(attraction)}
                  className="cursor-pointer"
                  animate={{ scale: active ? 1.16 : 1 }}
                >
                  {active && <circle r="18" fill={attraction.accent} opacity=".16"><animate attributeName="r" values="11;22" dur="1.8s" repeatCount="indefinite" /><animate attributeName="opacity" values=".32;0" dur="1.8s" repeatCount="indefinite" /></circle>}
                  <circle r="10" fill={attraction.accent} stroke="white" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                  <path d="M0 -4.3C-2.6-4.3-4.5-2.5-4.5 0c0 3.3 4.5 7.4 4.5 7.4S4.5 3.3 4.5 0C4.5-2.5 2.6-4.3 0-4.3Z" fill="white" transform="scale(.62)" />
                </motion.g>
              )
            })}
          </g>
        </svg>

        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[115%] rounded-xl border border-white bg-slate-950/90 px-3 py-2 text-white shadow-xl backdrop-blur"
              style={{ left: `${tooltip.x}%`, top: `${tooltip.y}%` }}
            >
              <p className="text-[9px] font-bold text-blue-300">{hovered.properties.districtName}</p>
              <p className="text-xs font-extrabold">{hovered.properties.name}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div className="absolute bottom-5 left-5 z-20 h-28 overflow-y-auto min-w-[245px] max-w-[calc(100%-2.5rem)] rounded-2xl border border-white bg-white/90 p-4 shadow-xl backdrop-blur">
          {focusedArea ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">{selected ? 'Selected' : 'Hovered'} {boundaryKind}</span>
                <h4 className="mt-1 text-sm font-bold text-slate-800">{focusedArea.properties.districtName} · {focusedArea.properties.name}</h4>

              </div>
            </div>
          ) : activeAttraction ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: activeAttraction.accent }}>{activeAttraction.category}</span>
                <h4 className="mt-1 text-sm font-bold text-slate-800">{activeAttraction.name}</h4>
                <p className="mt-1 text-[10px] text-slate-400">한국관광공사 콘텐츠 좌표</p>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-white"><MapPin size={14} /></span>
            </div>
          ) : (
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Administrative map</span>
              <h4 className="mt-1 text-sm font-bold text-slate-800">{district.nameKo} {neighborhoods.length}개 {boundaryKind}</h4>
              <p className="mt-1 text-[10px] text-slate-400">동을 클릭하면 선택한 지역이 여기에 표시됩니다.</p>
            </div>
          )}
        </motion.div>

        <div className="absolute bottom-5 right-5 z-20 hidden rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-[9px] font-bold text-slate-500 shadow-sm backdrop-blur sm:block">
          경계: {boundaryKind} · {Math.round(zoom * 100)}%
        </div>
      </div>
    </Card>
  )
}
