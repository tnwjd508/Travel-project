import { Outlet } from 'react-router-dom'
import { Header } from '@/components/navigation/Header'
import { Sidebar } from '@/components/navigation/Sidebar'

export function AppLayout() {
  return <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
    <Sidebar />
    <div className="lg:pl-[104px]">
      <Header />
      <main className="mx-auto max-w-[1580px] px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-8"><Outlet /></main>
    </div>
  </div>
}
