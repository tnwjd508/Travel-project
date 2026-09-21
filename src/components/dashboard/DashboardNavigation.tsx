import { BrainCircuit, ChartNoAxesCombined, FileText, FlaskConical, GitCompareArrows, House, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { useDashboardRegion } from '@/hooks/useDashboardRegion'

export interface DashboardMenuItem {
  label: string
  path: string
  icon: LucideIcon
  description: string
}

const dashboardMenuDefinitions = [
  { label: '지역 현황', section: 'overview', icon: House, description: '핵심 현황과 월간 브리핑' },
  { label: '관광 데이터', section: 'analytics', icon: ChartNoAxesCombined, description: '방문객·소비·공간 데이터' },
  { label: 'AI 지역 진단', section: 'diagnosis', icon: BrainCircuit, description: '핵심 문제와 개선 과제' },
  { label: '정책 시뮬레이션', section: 'simulation', icon: FlaskConical, description: '과거 축제 근거로 정책 검토' },
  { label: '전략 비교', section: 'strategy', icon: GitCompareArrows, description: '진단 지표 기준 전략 비교' },
  { label: 'AI 보고서', section: 'report', icon: FileText, description: '분석 결과 종합 보고서' },
]

export function getDashboardMenuItems(district: string, regionId = 'gwangju'): DashboardMenuItem[] {
  return dashboardMenuDefinitions.map(({ section, ...item }) => ({
    ...item,
    path: `/dashboard/${regionId}/${district}/${section}`,
  }))
}

export function DashboardNavigation() {
  const district = useDashboardRegion()
  const dashboardMenuItems = getDashboardMenuItems(district.slug, district.regionId)
  return <nav className="sticky top-[76px] z-30 hidden border-b border-slate-200/70 bg-white/85 backdrop-blur-xl lg:block" aria-label={`${district.regionName} 관광전략 카테고리`}>
    <div className="mx-auto flex h-[58px] max-w-[1580px] items-stretch gap-1 px-8">
      {dashboardMenuItems.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => cn('group relative flex items-center gap-2 rounded-lg px-4 text-xs font-bold transition-colors', isActive ? 'bg-blue-50/70 text-blue-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700')}>{({ isActive }) => <><Icon size={15} className="transition-transform group-hover:scale-110"/>{label}<span className={cn('absolute inset-x-4 bottom-0 h-0.5 origin-center rounded-full bg-blue-600 transition-transform', isActive ? 'scale-x-100' : 'scale-x-0')}/></>}</NavLink>)}
    </div>
  </nav>
}
