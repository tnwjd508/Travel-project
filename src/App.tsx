import { Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { LandingPage } from '@/pages/LandingPage'
import { AnalyticsPage } from '@/pages/dashboard/AnalyticsPage'
import { DiagnosisPage } from '@/pages/dashboard/DiagnosisPage'
import { OverviewPage } from '@/pages/dashboard/OverviewPage'
import { ReportPage } from '@/pages/dashboard/ReportPage'
import { SimulationPage } from '@/pages/dashboard/SimulationPage'
import { StrategyPage } from '@/pages/dashboard/StrategyPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<Navigate to="/dashboard/gwangju/overview" replace />} />
      <Route path="/dashboard/gwangju" element={<DashboardLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="diagnosis" element={<DiagnosisPage />} />
        <Route path="simulation" element={<SimulationPage />} />
        <Route path="strategy" element={<StrategyPage />} />
        <Route path="report" element={<ReportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
