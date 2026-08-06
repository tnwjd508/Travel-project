import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { MobileDashboardMenu } from '@/components/dashboard/MobileDashboardMenu'

export function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-900">
      <DashboardHeader onMenuClick={() => setMenuOpen(true)} />
      <DashboardSidebar />
      <MobileDashboardMenu open={menuOpen} onClose={closeMenu} />
      <main className="min-h-[calc(100vh-72px)] px-4 py-5 sm:px-6 sm:py-6 lg:ml-[230px] lg:px-7 lg:py-6">
        <div className="mx-auto w-full max-w-[1700px]"><Outlet /></div>
      </main>
    </div>
  )
}
