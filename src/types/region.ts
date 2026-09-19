export type RegionId = string

export type RegionStatus = 'available' | 'coming-soon'

export interface Region {
  id: RegionId
  nameKo: string
  nameEn: string
  description: string
  dashboardPath: string | null
  status: RegionStatus
  mapPosition: { x: number; y: number }
  accentColor: string
  heroImage?: string
  heroAlt?: string
  heroKeyword?: string
  tourApiAreaCode?: number
}
