import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SIMULATION_MODEL_STATUS, type PolicyDuration, type PolicyId } from '@/data/policies'
import type { DistrictSlug } from '@/data/gwangjuDistricts'

// 효과 예측 모델 연결 전에는 입력 조건만 저장하고 예측 수치는 만들지 않는다.
export interface SimulationScenario {
  district: DistrictSlug
  policy: PolicyId
  budget: number
  duration: PolicyDuration
  modelStatus: typeof SIMULATION_MODEL_STATUS
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
  completeSimulation: (district: DistrictSlug) => void
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
          modelStatus: SIMULATION_MODEL_STATUS,
          createdAt: new Date().toISOString(),
        },
      })),
    }),
    {
      name: 'ongil-tourism-strategy',
      version: 4,
      // Server records are loaded by ID; only unsaved form preferences stay local.
      partialize: (state) => ({ selectedRegion: state.selectedRegion, selectedProvince: state.selectedProvince,
        selectedDistrict: state.selectedDistrict, selectedPolicy: state.selectedPolicy, budget: state.budget, duration: state.duration }),
      // 이전 버전에 저장된 고정 예측값(+15% 등)은 버린다.
      migrate: (persisted) => {
        const next: Record<string, unknown> = { ...(persisted as Record<string, unknown> | undefined), simulationResult: null }
        delete next.recommendedStrategy
        return next as unknown as TourismStrategyState
      },
    },
  ),
)
