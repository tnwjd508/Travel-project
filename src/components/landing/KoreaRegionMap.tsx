import { motion } from 'framer-motion'
import southKoreaMap from '@svg-maps/south-korea'
import type { Region, RegionId } from '@/types/region'

interface KoreaRegionMapProps {
  regions: Region[]
  selectedId: RegionId
  onSelect: (region: Region) => void
}

const selectableIds = new Set<RegionId>(['gwangju', 'seoul', 'busan', 'daegu', 'incheon', 'jeju'])

interface MapLocation {
  id: string
  name: string
  path: string
}

const mapLocations = southKoreaMap.locations as MapLocation[]

export function KoreaRegionMap({ regions, selectedId, onSelect }: KoreaRegionMapProps) {
  const regionById = new Map(regions.map((region) => [region.id, region]))

  return (
    <motion.div id="region-map" initial={{ opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .85, delay: .35, ease: [0.16, 1, 0.3, 1] }} className="relative mx-auto aspect-[524/631] h-[430px] max-h-[58vh] min-h-[370px] w-auto max-w-full sm:h-[510px] lg:h-[600px] lg:max-h-[67vh]" aria-label="대한민국 지역 선택 지도">
      {[96, 76, 56].map((size, index) => <div key={size} className={`absolute left-1/2 top-1/2 rounded-full border ${index === 1 ? 'border-dashed' : ''} border-blue-300/[.09]`} style={{ width: `${size}%`, height: `${size * 524 / 631}%`, transform: 'translate(-50%, -50%)' }} />)}
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 45, repeat: Infinity, ease: 'linear' }} className="absolute left-1/2 top-1/2 h-[76%] w-[94%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[.045]">
        <span className="absolute left-1/2 top-[-3px] h-1.5 w-1.5 rounded-full bg-[#F4C57A] shadow-[0_0_14px_#F4C57A]" />
      </motion.div>

      <svg viewBox={southKoreaMap.viewBox} className="absolute inset-0 h-full w-full overflow-visible drop-shadow-[0_28px_48px_rgba(0,0,0,.38)]" aria-hidden="true">
        <defs>
          <linearGradient id="landingMapFill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1A2942" stopOpacity=".87" /><stop offset=".52" stopColor="#101D34" stopOpacity=".95" /><stop offset="1" stopColor="#0B1629" /></linearGradient>
          <linearGradient id="landingMapSelected" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#725B36" /><stop offset=".55" stopColor="#3C3850" /><stop offset="1" stopColor="#1D3150" /></linearGradient>
          <linearGradient id="landingMapStroke"><stop stopColor="#FFF9EE" stopOpacity=".72" /><stop offset=".55" stopColor="#9FB0C8" stopOpacity=".55" /><stop offset="1" stopColor="#60A5FA" stopOpacity=".42" /></linearGradient>
        </defs>
        <g stroke="url(#landingMapStroke)" strokeWidth=".78" strokeLinejoin="round">
          {mapLocations.map((location, index) => {
            const isSelected = location.id === selectedId
            const isSelectable = selectableIds.has(location.id as RegionId)
            return (
              <motion.path
                key={location.id}
                d={location.path}
                fill={isSelected ? 'url(#landingMapSelected)' : 'url(#landingMapFill)'}
                initial={{ opacity: 0, pathLength: 0 }}
                animate={{ opacity: isSelected ? 1 : isSelectable ? .9 : .72, pathLength: 1 }}
                transition={{ pathLength: { duration: .85, delay: .42 + index * .025 }, opacity: { duration: .3 } }}
              />
            )
          })}
        </g>
      </svg>

      {regions.map((region, index) => {
        const selected = region.id === selectedId
        return (
          <motion.button
            key={region.id}
            type="button"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: .9 + index * .1, type: 'spring', stiffness: 190, damping: 15 }}
            whileHover={{ scale: 1.18 }}
            onClick={() => onSelect(regionById.get(region.id) ?? region)}
            aria-label={`${region.nameKo} 선택${region.status === 'coming-soon' ? ', 서비스 준비 중' : ''}`}
            aria-pressed={selected}
            className="group absolute z-20 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#FFD89A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071020]"
            style={{ left: `${region.mapPosition.x / 5.24}%`, top: `${region.mapPosition.y / 6.31}%` }}
          >
            {selected && <motion.span className="absolute h-10 w-10 rounded-full border border-[#FFD89A]/70" animate={{ scale: [1, 2.1], opacity: [.75, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} />}
            <span className={`relative grid rounded-full border-2 transition-all duration-300 ${selected ? 'h-5 w-5 border-[#FFF9EE] bg-[#F4C57A] shadow-[0_0_8px_#F4C57A,0_0_24px_rgba(244,197,122,.75)]' : 'h-3 w-3 border-[#AAB4C5] bg-[#14233D] shadow-[0_0_10px_rgba(96,165,250,.28)] group-hover:border-[#F4C57A] group-hover:bg-[#F4C57A]'}`}><span className="m-auto h-1 w-1 rounded-full bg-white" /></span>
            <span className={`pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/[.08] bg-[#071020]/90 px-2 py-1 text-[9px] font-semibold backdrop-blur transition-all ${selected ? 'translate-x-0 text-[#FFF9EE] opacity-100' : '-translate-x-1 text-[#AAB4C5] opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100'}`}>{region.nameKo}</span>
          </motion.button>
        )
      })}
    </motion.div>
  )
}
