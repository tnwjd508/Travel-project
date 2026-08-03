import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { Dashboard } from '@/pages/Dashboard'

export default function App() {
  return <Routes><Route element={<AppLayout />}><Route path="*" element={<Dashboard />} /></Route></Routes>
}
