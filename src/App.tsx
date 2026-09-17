import { Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { LandingPage } from '@/pages/LandingPage'
import { AnalyticsPage } from '@/pages/dashboard/AnalyticsPage'
import { DiagnosisPage } from '@/pages/dashboard/DiagnosisPage'
import { OverviewPage } from '@/pages/dashboard/OverviewPage'
import { ReportPage } from '@/pages/dashboard/ReportPage'
import { SimulationPage } from '@/pages/dashboard/SimulationPage'
import { StrategyPage } from '@/pages/dashboard/StrategyPage'
import { GwangjuDistrictSelectPage } from '@/pages/regions/GwangjuDistrictSelectPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/regions/gwangju" element={<GwangjuDistrictSelectPage />} />
      <Route path="/dashboard" element={<Navigate to="/regions/gwangju" replace />} />
      <Route path="/dashboard/gwangju" element={<Navigate to="/regions/gwangju" replace />} />
      <Route path="/dashboard/gwangju/:district" element={<DashboardLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
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
