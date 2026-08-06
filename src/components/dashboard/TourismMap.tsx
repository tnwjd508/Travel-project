import { useMemo, useState, type PointerEvent } from 'react'
import { ArrowUpRight, Layers3, MapPin, Minus, Navigation, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import mapDataJson from '@/assets/data/gwangju-neighborhood-map.json'
import type { Attraction } from '@/types/tourism'

interface Neighborhood {
  code: string
  name: string
  districtCode: string
  districtId: string
  districtName: string
  path: string
  center: [number, number]
}

interface District {
  code: string
  id: string
  name: string
  color: string
  center: [number, number]
  neighborhoodCount: number
}

interface GwangjuMapData {
  sourceDate: string
  sourceCrs: string
  viewBox: [number, number, number, number]
  projection: {
    longitudeScale: number
    minX: number
    maxY: number
    scale: number
    xOffset: number
    yOffset: number
  }
  districts: District[]
  neighborhoods: Neighborhood[]
}

const mapData = mapDataJson as GwangjuMapData

const attractions: Attraction[] = [
  { name: '국립아시아문화전당', category: '문화예술', lng: 126.9199, lat: 35.1469, visitors: '12.8만', accent: '#2563EB' },
  { name: '무등산 국립공원', category: '자연', lng: 126.991, lat: 35.134, visitors: '9.4만', accent: '#22C55E' },
  { name: '양림역사문화마을', category: '역사', lng: 126.9146, lat: 35.1402, visitors: '7.6만', accent: '#8B5CF6' },
  { name: '대인예술시장', category: '미식·시장', lng: 126.9178, lat: 35.154, visitors: '5.2만', accent: '#F59E0B' },
]

const ZOOM_LEVELS = [1, 1.18, 1.38, 1.6]

function projectCoordinate(longitude: number, latitude: number) {
  const { longitudeScale, minX, maxY, scale, xOffset, yOffset } = mapData.projection
  return {
    x: xOffset + (longitude * longitudeScale - minX) * scale,
    y: yOffset + (maxY - latitude) * scale,
  }
}

export function TourismMap() {
  const [activeAttraction, setActiveAttraction] = useState<Attraction>(attractions[0])
  const [activeDistrictCode, setActiveDistrictCode] = useState<string>('all')
  const [hoveredNeighborhood, setHoveredNeighborhood] = useState<Neighborhood | null>(null)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<Neighborhood | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 50, y: 50 })
  const [zoomIndex, setZoomIndex] = useState(0)
  const [showNeighborhoods, setShowNeighborhoods] = useState(true)

  const districtByCode = useMemo(
    () => new Map(mapData.districts.map((district) => [district.code, district])),
    [],
  )
  const zoom = ZOOM_LEVELS[zoomIndex]
  const selectedArea = selectedNeighborhood ?? hoveredNeighborhood

  const updateTooltip = (event: PointerEvent<SVGPathElement>) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!bounds) return
    setTooltipPosition({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    })
  }

  const selectDistrict = (code: string) => {
    setActiveDistrictCode(code)
    setSelectedNeighborhood(null)
  }

  return (
    <Card className="grid min-h-[560px] overflow-hidden lg:grid-cols-[330px_1fr]">
      <aside className="z-10 border-b border-slate-100 bg-white/95 p-6 backdrop-blur lg:border-b-0 lg:border-r sm:p-7">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em] text-blue-600">
          <Navigation size={14} /> Tourism Map
        </div>
        <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900">광주를 96개 행정동으로<br />세밀하게 탐색하세요</h3>
        <p className="mt-3 text-xs leading-5 text-slate-400">자치구를 선택하고 지도 위 행정동에<br className="hidden lg:block" /> 마우스를 올려 지역 경계를 확인할 수 있습니다.</p>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">Administrative areas</span>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-600">5개 구 · 96개 동</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => selectDistrict('all')}
              className={`rounded-xl border px-2 py-2 text-[10px] font-bold transition ${activeDistrictCode === 'all' ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
            >
              전체 96
            </button>
            {mapData.districts.map((district) => (
              <button
                key={district.code}
                type="button"
                onClick={() => selectDistrict(district.code)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[10px] font-bold transition ${activeDistrictCode === district.code ? 'border-transparent text-white shadow-md' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                style={activeDistrictCode === district.code ? { backgroundColor: district.color } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: district.color }} />
                {district.name} {district.neighborhoodCount}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">Tourism hotspots</span>
          <div className="mt-2 space-y-1.5">
            {attractions.map((attraction) => (
              <button
                key={attraction.name}
                type="button"
                onMouseEnter={() => setActiveAttraction(attraction)}
                onFocus={() => setActiveAttraction(attraction)}
                onClick={() => setActiveAttraction(attraction)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${activeAttraction.name === attraction.name ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-transparent bg-slate-50 hover:border-slate-200'}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: attraction.accent, boxShadow: `0 0 0 4px ${attraction.accent}18` }} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-xs text-slate-700">{attraction.name}</b>
                  <span className="text-[10px] text-slate-400">{attraction.category}</span>
                </span>
                <b className="text-[10px] text-slate-500">{attraction.visitors}</b>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="map-grid relative min-h-[500px] overflow-hidden bg-[#edf5f7]">
        <div className="absolute left-5 top-5 z-20 rounded-xl border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Administrative coverage</p>
          <p className="mt-0.5 text-xs font-bold text-slate-700">2025. 06. 30. 기준 <span className="text-blue-600">96개 행정동</span></p>
        </div>

        <div className="absolute right-4 top-4 z-30 flex flex-col gap-2">
          <button type="button" aria-label="지도 확대" onClick={() => setZoomIndex((value) => Math.min(value + 1, ZOOM_LEVELS.length - 1))} disabled={zoomIndex === ZOOM_LEVELS.length - 1} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-500 shadow-md transition hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16} /></button>
          <button type="button" aria-label="지도 축소" onClick={() => setZoomIndex((value) => Math.max(value - 1, 0))} disabled={zoomIndex === 0} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-500 shadow-md transition hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"><Minus size={16} /></button>
          <button type="button" aria-label="행정동 경계 표시 전환" aria-pressed={showNeighborhoods} onClick={() => setShowNeighborhoods((value) => !value)} className={`mt-2 grid h-9 w-9 place-items-center rounded-xl shadow-md transition ${showNeighborhoods ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}><Layers3 size={16} /></button>
        </div>

        <svg viewBox={mapData.viewBox.join(' ')} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="광주광역시 96개 행정동 지도">
          <defs>
            <filter id="mapShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#64748B" floodOpacity=".18" />
            </filter>
            {mapData.districts.map((district) => (
              <linearGradient key={district.code} id={`district-${district.code}`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor={district.color} stopOpacity=".78" />
                <stop offset="1" stopColor={district.color} stopOpacity=".48" />
              </linearGradient>
            ))}
          </defs>

          <g transform={`translate(450 280) scale(${zoom}) translate(-450 -280)`} className="transition-transform duration-500 ease-out" filter="url(#mapShadow)">
            {mapData.neighborhoods.map((neighborhood) => {
              const district = districtByCode.get(neighborhood.districtCode)
              const selected = selectedNeighborhood?.code === neighborhood.code
              const hovered = hoveredNeighborhood?.code === neighborhood.code
              const districtActive = activeDistrictCode === 'all' || activeDistrictCode === neighborhood.districtCode
              return (
                <motion.path
                  key={neighborhood.code}
                  d={neighborhood.path}
                  fill={`url(#district-${neighborhood.districtCode})`}
                  fillRule="evenodd"
                  stroke={showNeighborhoods ? '#F8FAFC' : district?.color}
                  strokeWidth={selected ? 2.4 : showNeighborhoods ? 0.75 : 0.35}
                  vectorEffect="non-scaling-stroke"
                  initial={{ opacity: 0, pathLength: 0 }}
                  animate={{ opacity: districtActive ? selected || hovered ? 1 : .88 : .16, pathLength: 1 }}
                  transition={{ pathLength: { duration: .55 }, opacity: { duration: .2 } }}
                  onPointerEnter={() => setHoveredNeighborhood(neighborhood)}
                  onPointerMove={updateTooltip}
                  onPointerLeave={() => setHoveredNeighborhood(null)}
                  onClick={() => {
                    setSelectedNeighborhood(neighborhood)
                    setActiveDistrictCode(neighborhood.districtCode)
                  }}
                  className="cursor-pointer outline-none transition-[filter] duration-150 hover:brightness-110 focus:brightness-110"
                  tabIndex={0}
                  role="button"
                  aria-label={`${neighborhood.districtName} ${neighborhood.name} 선택`}
                />
              )
            })}

            {mapData.districts.map((district) => {
              const visible = activeDistrictCode === 'all' || activeDistrictCode === district.code
              return (
                <g key={district.code} transform={`translate(${district.center[0]} ${district.center[1]})`} opacity={visible ? 1 : .18} className="pointer-events-none transition-opacity">
                  <rect x="-28" y="-12" width="56" height="24" rx="12" fill="#0F172A" fillOpacity=".78" stroke="white" strokeOpacity=".65" />
                  <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize="10" fontWeight="800">{district.name}</text>
                </g>
              )
            })}

            {attractions.map((attraction) => {
              const point = projectCoordinate(attraction.lng, attraction.lat)
              const active = activeAttraction.name === attraction.name
              return (
                <motion.g
                  key={attraction.name}
                  transform={`translate(${point.x} ${point.y})`}
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
          {hoveredNeighborhood && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[115%] rounded-xl border border-white bg-slate-950/90 px-3 py-2 text-white shadow-xl backdrop-blur"
              style={{ left: `${tooltipPosition.x}%`, top: `${tooltipPosition.y}%` }}
            >
              <p className="text-[9px] font-bold text-blue-300">{hoveredNeighborhood.districtName}</p>
              <p className="text-xs font-extrabold">{hoveredNeighborhood.name}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div layout className="absolute bottom-5 left-5 z-20 min-w-[245px] max-w-[calc(100%-2.5rem)] rounded-2xl border border-white bg-white/92 p-4 shadow-xl backdrop-blur">
          {selectedArea ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">Selected neighborhood</span>
                <h4 className="mt-1 text-sm font-bold text-slate-800">{selectedArea.districtName} · {selectedArea.name}</h4>
                <p className="mt-1 text-[10px] text-slate-400">행정동 코드 <b className="text-slate-600">{selectedArea.code}</b></p>
              </div>
              <button type="button" aria-label="선택한 행정동 상세 보기" className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-white"><ArrowUpRight size={14} /></button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: activeAttraction.accent }}>{activeAttraction.category}</span>
                <h4 className="mt-1 text-sm font-bold text-slate-800">{activeAttraction.name}</h4>
                <p className="mt-1 text-[10px] text-slate-400">월 방문객 <b className="text-slate-600">{activeAttraction.visitors}</b> · 지도 좌표 연동</p>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-white"><MapPin size={14} /></span>
            </div>
          )}
        </motion.div>

        <div className="absolute bottom-5 right-5 z-20 hidden rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-[9px] font-bold text-slate-500 shadow-sm backdrop-blur sm:block">
          색상: 자치구 · 경계: 행정동 · {Math.round(zoom * 100)}%
        </div>
      </div>
    </Card>
  )
}
