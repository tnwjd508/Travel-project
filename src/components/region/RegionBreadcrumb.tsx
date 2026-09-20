import { ChevronRight, Map } from 'lucide-react'
import { Link } from 'react-router-dom'

export function RegionBreadcrumb({ districtName, regionName = '광주광역시', selectionPath = '/regions/gwangju' }: { districtName?: string; regionName?: string; selectionPath?: string }) {
  return (
    <nav aria-label="지역 경로" className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-slate-400">
      <Map size={13} className="text-blue-600" aria-hidden="true" />
      <Link to="/" className="rounded-md px-1 py-1 outline-none transition hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500">대한민국</Link>
      <ChevronRight size={12} aria-hidden="true" />
      <Link to={selectionPath} className="rounded-md px-1 py-1 outline-none transition hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500">{regionName}</Link>
      <ChevronRight size={12} aria-hidden="true" />
      <span className="text-slate-700">{districtName ?? '자치구 선택'}</span>
    </nav>
  )
}
