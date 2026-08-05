import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PolicyDuration, PolicyId } from '@/data/policies'

export interface SimulationResult {
  visitorChange: number
  spendingChange: number
  stayChange: number
  congestionChange: number
  economicImpact: '높음' | '매우 높음'
  analyzedAt: string
}

interface TourismStrategyState {
  selectedRegion: 'gwangju'
  selectedPolicy: PolicyId
  budget: number
  duration: PolicyDuration
  simulationResult: SimulationResult | null
  recommendedStrategy: PolicyId
  setSelectedPolicy: (policy: PolicyId) => void
  setBudget: (budget: number) => void
  setDuration: (duration: PolicyDuration) => void
  clearSimulationResult: () => void
  completeSimulation: () => void
}

export const useTourismStrategyStore = create<TourismStrategyState>()(
  persist(
    (set) => ({
      selectedRegion: 'gwangju',
      selectedPolicy: 'night',
      budget: 15,
      duration: '6개월',
      simulationResult: null,
      recommendedStrategy: 'night',
      setSelectedPolicy: (selectedPolicy) => set({ selectedPolicy }),
      setBudget: (budget) => set({ budget }),
      setDuration: (duration) => set({ duration }),
      clearSimulationResult: () => set({ simulationResult: null }),
      completeSimulation: () => set({
        simulationResult: {
          visitorChange: 15,
          spendingChange: 18,
          stayChange: 11,
          congestionChange: -8,
          economicImpact: '매우 높음',
          analyzedAt: new Date().toISOString(),
        },
        recommendedStrategy: 'night',
      }),
    }),
    {
      name: 'ongil-tourism-strategy',
      version: 1,
    },
  ),
)
