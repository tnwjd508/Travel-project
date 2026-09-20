import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { MobileDashboardMenu } from '@/components/dashboard/MobileDashboardMenu'
import { resolveDashboardRegion } from '@/data/dashboardRegions'
import { useTourismStrategyStore } from '@/stores/useTourismStrategyStore'
import { RegionBreadcrumb } from '@/components/region/RegionBreadcrumb'
import { SettingsDialog } from '@/components/settings/SettingsDialog'

export function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsTrigger = useRef<HTMLElement | null>(null)
  const openSettings = useCallback(() => {
    settingsTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSettingsOpen(true)
  }, [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const location = useLocation()
  const { regionId = 'gwangju', district = '' } = useParams()
  const activeDistrict = resolveDashboardRegion(regionId, district)
  const setSelectedDistrict = useTourismStrategyStore((state) => state.setSelectedDistrict)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (activeDistrict?.legacy) setSelectedDistrict(activeDistrict.legacy.slug)
  }, [activeDistrict?.legacy, setSelectedDistrict])

  if (!activeDistrict) return <Navigate to={`/regions/${regionId}`} replace />

  return (
    <div className="dashboard-shell min-h-screen bg-[#F7F9FC] text-slate-900">
      <DashboardHeader onMenuClick={() => setMenuOpen(true)} />
      <DashboardSidebar onOpenSettings={openSettings} />
      <MobileDashboardMenu open={menuOpen} onClose={closeMenu} onOpenSettings={openSettings} />
      <main className="min-h-[calc(100vh-72px)] px-4 py-5 sm:px-6 sm:py-6 lg:ml-[230px] lg:px-7 lg:py-6">
        <div className="mx-auto w-full max-w-[1700px]"><div className="mb-4"><RegionBreadcrumb districtName={activeDistrict.nameKo} regionName={activeDistrict.regionName} selectionPath={activeDistrict.selectionPath} /></div><Outlet /></div>
      </main>
      {settingsOpen && <SettingsDialog onClose={closeSettings} returnFocusTo={settingsTrigger.current} />}
    </div>
  )
}
