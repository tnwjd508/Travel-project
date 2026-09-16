import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { MobileDashboardMenu } from '@/components/dashboard/MobileDashboardMenu'
import { getGwangjuDistrict } from '@/data/gwangjuDistricts'
import { useTourismStrategyStore } from '@/stores/useTourismStrategyStore'
import { RegionBreadcrumb } from '@/components/region/RegionBreadcrumb'

export function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { district } = useParams<{ district: string }>()
  const activeDistrict = getGwangjuDistrict(district)
  const setSelectedDistrict = useTourismStrategyStore((state) => state.setSelectedDistrict)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (activeDistrict) setSelectedDistrict(activeDistrict.slug)
  }, [activeDistrict, setSelectedDistrict])

  if (!activeDistrict) return <Navigate to="/regions/gwangju" replace />

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-900">
      <DashboardHeader onMenuClick={() => setMenuOpen(true)} />
      <DashboardSidebar />
      <MobileDashboardMenu open={menuOpen} onClose={closeMenu} />
      <main className="min-h-[calc(100vh-72px)] px-4 py-5 sm:px-6 sm:py-6 lg:ml-[230px] lg:px-7 lg:py-6">
        <div className="mx-auto w-full max-w-[1700px]"><div className="mb-4"><RegionBreadcrumb districtName={activeDistrict.nameKo} /></div><Outlet /></div>
      </main>
    </div>
  )
}
