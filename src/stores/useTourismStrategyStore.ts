import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PolicyDuration, PolicyId } from '@/data/policies'
import type { DistrictSlug } from '@/data/gwangjuDistricts'
import type { DistrictId } from '@/data/tourismRegions'

// 입력 조건만 저장한다. 분석 근거와 저장된 검토는 서버에서 조회한다.
export interface SimulationScenario {
  district: DistrictId
  policy: PolicyId
  duration: PolicyDuration
  createdAt: string
}

interface TourismStrategyState {
  selectedRegion: 'gwangju'
  selectedProvince: 'gwangju'
  selectedDistrict: DistrictSlug | null
  selectedPolicy: PolicyId
  duration: PolicyDuration
  simulationResult: SimulationScenario | null
  setSelectedProvince: (province: 'gwangju') => void
  setSelectedDistrict: (district: DistrictSlug | null) => void
  clearSelectedRegion: () => void
  setSelectedPolicy: (policy: PolicyId) => void
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
      duration: '6개월',
      simulationResult: null,
      setSelectedProvince: (selectedProvince) => set({ selectedProvince }),
      setSelectedDistrict: (selectedDistrict) => set({ selectedDistrict }),
      clearSelectedRegion: () => set({ selectedProvince: 'gwangju', selectedDistrict: null }),
      setSelectedPolicy: (selectedPolicy) => set({ selectedPolicy }),
      setDuration: (duration) => set({ duration }),
      clearSimulationResult: () => set({ simulationResult: null }),
      completeSimulation: (district) => set((state) => ({
        simulationResult: {
          district,
          policy: state.selectedPolicy,
          duration: state.duration,
          createdAt: new Date().toISOString(),
        },
      })),
    }),
    {
      name: 'ongil-tourism-strategy',
      version: 6,
      // Persist only input preferences. Saved records are retrieved by server ID.
      partialize: (state) => ({ selectedRegion: state.selectedRegion, selectedProvince: state.selectedProvince,
        selectedDistrict: state.selectedDistrict, selectedPolicy: state.selectedPolicy, duration: state.duration }),
      // 이전 버전에 저장된 결과(고정 예측값·모델 상태)는 버린다.
      migrate: (persisted) => {
        const next: Record<string, unknown> = { ...(persisted as Record<string, unknown> | undefined), simulationResult: null }
        delete next.recommendedStrategy
        delete next.budget  // 효과 추정에 쓰이지 않아 입력에서 제거
        return next as unknown as TourismStrategyState
      },
    },
  ),
)
