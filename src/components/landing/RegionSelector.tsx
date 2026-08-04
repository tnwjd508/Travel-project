import { MapPin } from 'lucide-react'
import type { Region, RegionId } from '@/types/region'

interface RegionSelectorProps {
  regions: Region[]
  selectedId: RegionId
  onSelect: (region: Region) => void
}

export function RegionSelector({ regions, selectedId, onSelect }: RegionSelectorProps) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5 lg:justify-start" aria-label="지역 선택 목록">
      {regions.map((region) => {
        const selected = region.id === selectedId
        return (
          <button
            key={region.id}
            type="button"
            onClick={() => onSelect(region)}
            aria-pressed={selected}
            className={`group inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[10px] font-semibold tracking-[-.01em] outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#F4C57A]/70 sm:text-[11px] ${selected ? 'border-[#F4C57A]/60 bg-[#F4C57A]/10 text-[#FFF9EE] shadow-[0_0_22px_rgba(244,197,122,.12)]' : 'border-white/[.09] bg-white/[.025] text-[#78849A] hover:border-white/[.18] hover:text-[#D6DCE7]'}`}
          >
            <MapPin size={11} className={selected ? 'text-[#F4C57A]' : 'text-[#64748B]'} />
            {region.nameKo.replace('광역시', '').replace('특별시', '').replace('특별자치도', '')}
            {region.status === 'coming-soon' && <span className="sr-only">서비스 준비 중</span>}
          </button>
        )
      })}
    </div>
  )
}
