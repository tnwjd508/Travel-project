import { useState } from 'react'
import { MapPin, Navigation, Plus, Minus, Layers3, ArrowUpRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { geoMercator, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import { Card } from '@/components/ui/Card'
import type { Attraction } from '@/types/tourism'
import districtData from '@/assets/data/gwangju-districts.json'

interface DistrictProperties {
  code: string
  name: string
}

const districts = districtData as FeatureCollection<Geometry, DistrictProperties>

// RFC 7946 GeoJSON uses the opposite exterior-ring winding from d3-geo's
// spherical polygon convention. Reverse rings only for SVG rendering while
// keeping the stored GeoJSON standards-compliant.
const renderedDistricts: FeatureCollection<Geometry, DistrictProperties> = {
  ...districts,
  features: districts.features.map((feature) => ({
    ...feature,
    geometry: feature.geometry.type === 'Polygon'
      ? { ...feature.geometry, coordinates: feature.geometry.coordinates.map((ring) => [...ring].reverse()) }
      : feature.geometry.type === 'MultiPolygon'
        ? { ...feature.geometry, coordinates: feature.geometry.coordinates.map((polygon) => polygon.map((ring) => [...ring].reverse())) }
        : feature.geometry,
  })),
}

const districtProjection = geoMercator().fitExtent([[82, 42], [678, 458]], renderedDistricts)
const districtPath = geoPath(districtProjection)
const districtFills = ['#DBEAFE', '#E0E7FF', '#DFF7F1', '#EDE9FE', '#E2E8F0']

const attractions: Attraction[] = [
  {name:'국립아시아문화전당',category:'문화예술',x:46,y:49,visitors:'12.8만',accent:'#2563EB'},
  {name:'무등산 국립공원',category:'자연',x:72,y:24,visitors:'9.4만',accent:'#22C55E'},
  {name:'양림역사문화마을',category:'역사',x:34,y:66,visitors:'7.6만',accent:'#8B5CF6'},
  {name:'대인예술시장',category:'미식·시장',x:54,y:38,visitors:'5.2만',accent:'#F59E0B'},
]

export function TourismMap() {
  const [active,setActive]=useState<Attraction|null>(attractions[0])
  return <Card className="grid min-h-[470px] overflow-hidden lg:grid-cols-[320px_1fr]">
    <div className="z-10 border-b border-slate-100 bg-white/90 p-6 backdrop-blur lg:border-b-0 lg:border-r sm:p-7"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em] text-blue-600"><Navigation size={14}/>Tourism Map</div><h3 className="mt-1 text-xl font-bold tracking-tight">광주의 매력을<br/>데이터로 탐색하세요</h3><p className="mt-3 text-xs leading-5 text-slate-400">주요 관광지의 방문 흐름과 잠재력을<br className="hidden lg:block"/> 한눈에 확인합니다.</p>
      <div className="mt-6 space-y-2">{attractions.map(a=><button key={a.name} onMouseEnter={()=>setActive(a)} onClick={()=>setActive(a)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${active?.name===a.name?'border-blue-200 bg-blue-50 shadow-sm':'border-transparent bg-slate-50 hover:border-slate-200'}`}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background:a.accent,boxShadow:`0 0 0 4px ${a.accent}18`}}/><span className="min-w-0 flex-1"><b className="block truncate text-xs text-slate-700">{a.name}</b><span className="text-[10px] text-slate-400">{a.category}</span></span><b className="text-[10px] text-slate-500">{a.visitors}</b></button>)}</div>
    </div>
    <div className="map-grid relative min-h-[430px] overflow-hidden bg-[#eef5f7]">
      <div className="absolute right-4 top-4 z-20 flex flex-col gap-2"><button className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-500 shadow-md"><Plus size={16}/></button><button className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-500 shadow-md"><Minus size={16}/></button><button className="mt-2 grid h-9 w-9 place-items-center rounded-xl bg-white text-blue-600 shadow-md"><Layers3 size={16}/></button></div>
      <svg viewBox="0 0 760 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="광주광역시 5개 자치구 행정구역 지도">
        <g fill="none" stroke="#D9E5E9" strokeWidth="2"><path d="M0 90 C140 130 190 70 330 105 S600 110 760 45"/><path d="M-10 325 C130 285 225 360 380 300 S630 280 780 340"/><path d="M130 0 C180 130 125 215 190 500"/><path d="M535 -10 C485 110 570 200 510 510"/></g>
        <g stroke="#FFFFFF" strokeWidth="2.2" strokeLinejoin="round">
          {renderedDistricts.features.map((district, index) => <motion.path
            key={district.properties.code}
            d={districtPath(district) ?? undefined}
            fill={districtFills[index % districtFills.length]}
            initial={{ opacity: 0, scale: .985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: .45, delay: index * .06 }}
            style={{ transformOrigin: 'center' }}
          ><title>{district.properties.name}</title></motion.path>)}
        </g>
        <g pointerEvents="none" textAnchor="middle" dominantBaseline="middle" fontFamily="Pretendard, sans-serif" fontSize="12" fontWeight="800" fill="#475569" stroke="#FFFFFF" strokeWidth="3" paintOrder="stroke">
          {renderedDistricts.features.map((district) => {
            const [x, y] = districtPath.centroid(district)
            return <text key={`${district.properties.code}-label`} x={x} y={y}>{district.properties.name}</text>
          })}
        </g>
      </svg>
      <div className="absolute left-5 top-5 rounded-xl border border-white/80 bg-white/80 px-3 py-2 shadow-sm backdrop-blur"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Data coverage</p><p className="mt-0.5 text-xs font-bold text-slate-700">광주광역시 전역 <span className="text-blue-600">98.7%</span></p></div>
      {attractions.map(a=><motion.button key={a.name} onMouseEnter={()=>setActive(a)} whileHover={{scale:1.15}} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{left:`${a.x}%`,top:`${a.y}%`}}><span className="relative grid h-9 w-9 place-items-center rounded-full border-[3px] border-white text-white shadow-lg" style={{background:a.accent}}><MapPin size={15} fill="white"/><span className="absolute inset-0 -z-10 animate-ping rounded-full opacity-20" style={{background:a.accent}}/></span></motion.button>)}
      {active&&<motion.div key={active.name} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="absolute bottom-5 left-5 z-20 min-w-[230px] rounded-2xl border border-white bg-white/90 p-4 shadow-xl backdrop-blur"><div className="flex items-start justify-between gap-4"><div><span className="text-[9px] font-bold uppercase tracking-wider" style={{color:active.accent}}>{active.category}</span><h4 className="mt-1 text-sm font-bold text-slate-800">{active.name}</h4><p className="mt-1 text-[10px] text-slate-400">월 방문객 <b className="text-slate-600">{active.visitors}</b> · 성장 잠재력 높음</p></div><button className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-white"><ArrowUpRight size={14}/></button></div></motion.div>}
    </div>
  </Card>
}
