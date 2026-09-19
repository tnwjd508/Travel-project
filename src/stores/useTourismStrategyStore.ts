import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PolicyDuration, PolicyId } from '@/data/policies'
import type { DistrictSlug } from '@/data/gwangjuDistricts'
import type { DistrictId } from '@/data/tourismRegions'

// 입력 조건만 저장한다. 효과 수치는 화면에서 근거 자료(festival-effect.json)로 계산한다.
export interface SimulationScenario {
  district: DistrictId
  policy: PolicyId
  budget: number
  duration: PolicyDuration
  createdAt: string
}

interface TourismStrategyState {
  selectedRegion: 'gwangju'
  selectedProvince: 'gwangju'
  selectedDistrict: DistrictSlug | null
  selectedPolicy: PolicyId
  budget: number
  duration: PolicyDuration
  simulationResult: SimulationScenario | null
  setSelectedProvince: (province: 'gwangju') => void
  setSelectedDistrict: (district: DistrictSlug | null) => void
  clearSelectedRegion: () => void
  setSelectedPolicy: (policy: PolicyId) => void
  setBudget: (budget: number) => void
  setDuration: (duration: PolicyDuration) => void
  clearSimulationResult: () => void
  completeSimulation: (district: DistrictId) => void
}

export const useTourismStrategyStore = create<TourismStrategyState>()(
  persist(
    (set) => ({
      selectedRegion: 'gwangju',
      selectedProvince: 'gwangju',
      selectedDistrict: null,
      selectedPolicy: 'night',
      budget: 15,
      duration: '6개월',
      simulationResult: null,
      setSelectedProvince: (selectedProvince) => set({ selectedProvince }),
      setSelectedDistrict: (selectedDistrict) => set({ selectedDistrict }),
      clearSelectedRegion: () => set({ selectedProvince: 'gwangju', selectedDistrict: null }),
      setSelectedPolicy: (selectedPolicy) => set({ selectedPolicy }),
      setBudget: (budget) => set({ budget }),
      setDuration: (duration) => set({ duration }),
      clearSimulationResult: () => set({ simulationResult: null }),
      completeSimulation: (district) => set((state) => ({
        simulationResult: {
          district,
          policy: state.selectedPolicy,
          budget: state.budget,
          duration: state.duration,
          createdAt: new Date().toISOString(),
        },
      })),
    }),
    {
      name: 'ongil-tourism-strategy',
      version: 5,
      // Persist only input preferences. Saved records are retrieved by server ID.
      partialize: (state) => ({ selectedRegion: state.selectedRegion, selectedProvince: state.selectedProvince,
        selectedDistrict: state.selectedDistrict, selectedPolicy: state.selectedPolicy, budget: state.budget, duration: state.duration }),
      // 이전 버전에 저장된 결과(고정 예측값·모델 상태)는 버린다.
      migrate: (persisted) => {
        const next: Record<string, unknown> = { ...(persisted as Record<string, unknown> | undefined), simulationResult: null }
        delete next.recommendedStrategy
        return next as unknown as TourismStrategyState
      },
    },
  ),
)
