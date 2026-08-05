import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { DashboardNavigation } from '@/components/dashboard/DashboardNavigation'
import { MobileDashboardMenu } from '@/components/dashboard/MobileDashboardMenu'
import { Header } from '@/components/navigation/Header'

export function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    setMenuOpen(false)
  }, [location.pathname])

  return <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
    <Header onMenuClick={() => setMenuOpen(true)} />
    <DashboardNavigation />
    <MobileDashboardMenu open={menuOpen} onClose={closeMenu} />
    <main className="mx-auto min-h-[calc(100vh-134px)] max-w-[1580px] px-4 pb-14 pt-6 sm:px-6 lg:px-8 lg:pt-8"><Outlet /></main>
  </div>
}
