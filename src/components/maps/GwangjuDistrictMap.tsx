import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { motion } from 'framer-motion'
import { geoMercator, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import districtData from '@/assets/data/gwangju-districts.json'
import type { DistrictSlug } from '@/data/gwangjuDistricts'
import { getDistrictCode, getDistrictName, getDistrictSlug } from '@/utils/geoProperties'

interface DistrictGeoProperties extends Record<string, unknown> {
  code?: string
  name?: string
}

interface GwangjuDistrictMapProps {
  selectedDistrict: DistrictSlug | null
  onSelectDistrict: (district: DistrictSlug) => void
  onConfirmDistrict?: (district: DistrictSlug) => void
  variant?: 'light' | 'landing'
}

const sourceDistricts = districtData as FeatureCollection<Geometry, DistrictGeoProperties>
const allowedNames = new Set(['동구', '서구', '남구', '북구', '광산구'])

const renderedDistricts: FeatureCollection<Geometry, DistrictGeoProperties> = {
  ...sourceDistricts,
  features: sourceDistricts.features
    .filter((feature) => allowedNames.has(getDistrictName(feature.properties) ?? ''))
    .map((feature) => ({
      ...feature,
      geometry: feature.geometry.type === 'Polygon'
        ? { ...feature.geometry, coordinates: feature.geometry.coordinates.map((ring) => [...ring].reverse()) }
        : feature.geometry.type === 'MultiPolygon'
          ? { ...feature.geometry, coordinates: feature.geometry.coordinates.map((polygon) => polygon.map((ring) => [...ring].reverse())) }
          : feature.geometry,
    })),
}

const projection = geoMercator().fitExtent([[58, 42], [742, 548]], renderedDistricts)
const mapPath = geoPath(projection)
const labelOffsets: Record<DistrictSlug, [number, number]> = {
  donggu: [18, 5],
  seogu: [0, -2],
  namgu: [8, 12],
  bukgu: [0, -6],
  gwangsangu: [-5, 0],
}

export function GwangjuDistrictMap({ selectedDistrict, onSelectDistrict, onConfirmDistrict, variant = 'light' }: GwangjuDistrictMapProps) {
  const [hoveredDistrict, setHoveredDistrict] = useState<DistrictSlug | null>(null)
  const [tooltip, setTooltip] = useState({ x: 50, y: 50 })
  const isLanding = variant === 'landing'

  const features = useMemo(() => renderedDistricts.features.flatMap((feature) => {
    const name = getDistrictName(feature.properties)
    const slug = getDistrictSlug(name)
    if (!name || !slug) return []
    return [{ feature, name, slug, code: getDistrictCode(feature.properties) ?? '' }]
  }), [])

  const activate = (slug: DistrictSlug) => {
    if (selectedDistrict === slug && onConfirmDistrict) {
      onConfirmDistrict(slug)
      return
    }
    onSelectDistrict(slug)
  }

  const handleKeyDown = (event: KeyboardEvent<SVGPathElement>, slug: DistrictSlug) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    activate(slug)
  }

  const updateTooltip = (event: PointerEvent<SVGPathElement>) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!bounds) return
    setTooltip({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    })
  }

  const hoveredName = features.find(({ slug }) => slug === hoveredDistrict)?.name

  return (
    <div className={isLanding
      ? 'relative isolate mx-auto h-[430px] max-h-[58vh] min-h-[370px] w-full max-w-[650px] overflow-visible sm:h-[510px] lg:h-[600px] lg:max-h-[67vh]'
      : 'relative isolate min-h-[430px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-[#F8FAFC] shadow-[0_24px_70px_rgba(15,23,42,.09)] sm:min-h-[560px]'}>
      <div className={isLanding
        ? 'pointer-events-none absolute inset-[8%] rounded-full border border-blue-300/[.08] bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,.12),transparent_62%)] shadow-[0_0_80px_rgba(37,99,235,.08)]'
        : 'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(37,99,235,.12),transparent_34%),linear-gradient(145deg,rgba(255,255,255,.96),rgba(239,246,255,.72))]'} />
      {isLanding && <div className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[.055]" />}
      <div className={isLanding
        ? 'absolute left-5 top-5 z-20 rounded-full border border-[#F4C57A]/20 bg-[#0B1528]/85 px-3 py-1.5 text-[9px] font-bold tracking-[.08em] text-[#FFD89A] shadow-lg backdrop-blur'
        : 'absolute left-5 top-5 z-20 rounded-full border border-blue-100 bg-white/90 px-3 py-1.5 text-[10px] font-bold text-blue-700 shadow-sm backdrop-blur'}>
        광주광역시 · 5개 자치구
      </div>

      <svg
        viewBox="0 0 800 590"
        className="absolute inset-0 h-full w-full overflow-visible p-3 sm:p-5"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="광주광역시 동구, 서구, 남구, 북구, 광산구를 선택하는 행정구역 지도"
      >
        {isLanding && (
          <defs>
            <linearGradient id="landingDistrictDefault" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1A2942" stopOpacity=".94" /><stop offset="1" stopColor="#0D1B30" /></linearGradient>
            <linearGradient id="landingDistrictHover" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#3A4960" /><stop offset="1" stopColor="#1C3658" /></linearGradient>
            <linearGradient id="landingDistrictSelected" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#F8D89C" /><stop offset="1" stopColor="#B97B34" /></linearGradient>
            <filter id="landingDistrictGlow" x="-35%" y="-35%" width="170%" height="170%"><feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#F4C57A" floodOpacity=".5" /></filter>
          </defs>
        )}
        <g strokeLinejoin="round">
          {features.map(({ feature, name, slug, code }, index) => {
            const selected = selectedDistrict === slug
            const hovered = hoveredDistrict === slug
            return (
              <motion.path
                key={code || slug}
                d={mapPath(feature) ?? undefined}
                initial={{ opacity: 0, scale: .97 }}
                animate={{ opacity: 1, scale: selected ? 1.012 : 1 }}
                transition={{ delay: .12 + index * .08, duration: .42, ease: [0.16, 1, 0.3, 1] }}
                fill={isLanding ? selected ? 'url(#landingDistrictSelected)' : hovered ? 'url(#landingDistrictHover)' : 'url(#landingDistrictDefault)' : selected ? '#2563EB' : hovered ? '#BFDBFE' : '#E5EDF7'}
                stroke={isLanding ? selected ? '#FFE7B5' : hovered ? '#F4C57A' : '#62748F' : selected ? '#1D4ED8' : hovered ? '#60A5FA' : '#FFFFFF'}
                strokeWidth={selected ? 4 : hovered ? 3 : 2.2}
                filter={isLanding && selected ? 'url(#landingDistrictGlow)' : undefined}
                vectorEffect="non-scaling-stroke"
                style={{ transformOrigin: 'center', cursor: 'pointer', outline: 'none' }}
                tabIndex={0}
                role="button"
                aria-label={`${name} 선택`}
                aria-pressed={selected}
                onPointerEnter={() => setHoveredDistrict(slug)}
                onPointerMove={updateTooltip}
                onPointerLeave={() => setHoveredDistrict(null)}
                onFocus={() => setHoveredDistrict(slug)}
                onBlur={() => setHoveredDistrict(null)}
                onClick={() => activate(slug)}
                onKeyDown={(event) => handleKeyDown(event, slug)}
                className={isLanding ? 'transition-[fill,stroke,filter] duration-200 hover:brightness-125 focus-visible:stroke-[#FFD89A] focus-visible:[filter:drop-shadow(0_0_8px_rgba(244,197,122,.65))]' : 'transition-[fill,stroke,filter] duration-200 hover:brightness-[1.02] focus-visible:stroke-blue-950 focus-visible:[filter:drop-shadow(0_0_8px_rgba(37,99,235,.45))]'}
              >
                <title>{name} 선택</title>
              </motion.path>
            )
          })}
        </g>

        <g pointerEvents="none" textAnchor="middle" dominantBaseline="middle" fontFamily="Pretendard, sans-serif">
          {features.map(({ feature, name, slug }) => {
            const [baseX, baseY] = mapPath.centroid(feature)
            const [offsetX, offsetY] = labelOffsets[slug]
            const selected = selectedDistrict === slug
            return (
              <motion.g key={`${slug}-label`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .48 }}>
                <text x={baseX + offsetX} y={baseY + offsetY} fill={isLanding ? selected ? '#071020' : '#E7EDF7' : selected ? '#FFFFFF' : '#334155'} stroke={isLanding ? selected ? '#F4C57A' : '#0A1628' : selected ? '#2563EB' : '#F8FAFC'} strokeWidth="4" paintOrder="stroke" fontSize={name === '광산구' ? 15 : 14} fontWeight="800">
                  {name}
                </text>
                {selected && (
                  <g transform={`translate(${baseX + offsetX + (name === '광산구' ? 34 : 24)} ${baseY + offsetY - 18})`}>
                    <circle r="11" fill={isLanding ? '#071020' : '#FFFFFF'} stroke={isLanding ? '#FFD89A' : '#DBEAFE'} strokeWidth="2" />
                    <text y="1" fill={isLanding ? '#FFD89A' : '#2563EB'} stroke="none" fontSize="12" fontWeight="900">✓</text>
                  </g>
                )}
              </motion.g>
            )
          })}
        </g>
      </svg>

      {hoveredName && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={isLanding ? 'pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg border border-[#F4C57A]/20 bg-[#071020]/95 px-3 py-2 text-[10px] font-bold text-[#FFF9EE] shadow-xl' : 'pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-bold text-white shadow-xl'}
          style={{ left: `${tooltip.x}%`, top: `${tooltip.y}%` }}
        >
          {hoveredName} 선택
        </motion.div>
      )}

      <p className="sr-only" aria-live="polite">
        {selectedDistrict ? `${features.find(({ slug }) => slug === selectedDistrict)?.name ?? ''}가 선택되었습니다. 지역 현황 화면으로 이동합니다.` : '선택된 자치구가 없습니다.'}
      </p>
      <p className={isLanding ? 'absolute bottom-5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/[.08] bg-[#0B1528]/88 px-4 py-2 text-[9px] font-semibold text-[#AAB4C5] shadow-lg backdrop-blur' : 'absolute bottom-5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-white bg-white/85 px-4 py-2 text-[10px] font-semibold text-slate-500 shadow-sm backdrop-blur'}>
        자치구 모양을 클릭해 지역 현황으로 이동
      </p>
    </div>
  )
}
