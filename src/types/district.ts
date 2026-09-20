export type { DistrictId as DistrictSlug } from '../data/tourismRegions.js'
import type { DistrictId as DistrictSlug } from '../data/tourismRegions.js'
export interface DistrictMeta {
  baseYm: string
  source: '출처: ⓒ한국관광공사'
  fetchedAt: string
  warnings: string[]
}
export interface VisitorMonth {
  ym: string
  total: number | null
  local: number | null
  outside: number | null
  foreign: number | null
  complete: boolean
  observedDays: number
  expectedDays: number
  through: string | null
}
export interface VisitorsResponse extends DistrictMeta {
  district: DistrictSlug
  metric: 'sum_of_daily_estimated_visitors'
  series: VisitorMonth[]
  previousYear: VisitorMonth[]
}
export interface SummaryResponse extends DistrictMeta {
  district: DistrictSlug
  visitors: VisitorMonth & { month: string; momPct: number | null }
  stay: { ix21: number | null; ix2102: number | null }
  spend: { ix22: number | null; ix2201: number | null }
  demand: { ix11: number | null }
  age: { ix3102: number | null; ix3103: number | null; momPct: number | null }
  indexUnit: 'index'
  visitorsMetric: 'sum_of_daily_estimated_visitors'
}
export interface AllSummaryResponse extends DistrictMeta { items: SummaryResponse[] }
export type IndexGroup = 'stay' | 'spend' | 'touristDiversity' | 'spendDiversity' | 'international' | 'demand' | 'culture'
export interface IndicesResponse extends DistrictMeta {
  district: DistrictSlug
  unit: 'index'
  groups: Record<IndexGroup, Record<string, number | null>>
}
export interface ContentItem {
  contentId: string; title: string; lng: number | null; lat: number | null
  category: string; image: string | null; addr: string; copyrightType: string | null
}
export interface ContentsResponse extends DistrictMeta {
  district: DistrictSlug; items: ContentItem[]; totalCount: number
  typeShare: { category: string; count: number; pct: number }[]
  distributionBasis: 'content_count'; temporalBasis: 'fetchedAt'
}
export interface FestivalsResponse extends DistrictMeta {
  district: DistrictSlug; from: string; temporalBasis: 'event_dates'
  items: { contentId: string; title: string; start: string; end: string; place: string; image: string | null }[]
}
export interface RelatedResponse extends DistrictMeta {
  district: DistrictSlug; metric: 'related_link_share'
  hubs: { tAtsCd: string; name: string; relatedCount: number; share: number }[]
  top3Share: number | null
  categoryMix: { category: string; count: number; pct: number }[]
}
export interface HubsResponse extends DistrictMeta {
  district: DistrictSlug; metric: 'hub_link_centrality_rank'; totalCount: number
  items: { rank: number; name: string; category: string | null; lng: number | null; lat: number | null }[]
}
export interface RankResponse extends DistrictMeta {
  district: DistrictSlug; metric: string; rank: number | null; total: number
  percentile: number | null; topPct: number | null; complete: boolean
  missingAreas: string[]
  missingDistricts: string[]
  scope: 'observed_nationwide_districts'
  populationVerified: false
}
export interface DiagnosisResponse extends DistrictMeta {
  district: DistrictSlug; model: { version: string; status: 'provisional'; description: string }
  issues: { id: string; label: string; value: number | null; unit: 'index' | 'percent'; status: 'attention' | 'normal' | 'unknown'; evidence: string }[]
  priorities: { issueId: string; title: string; evidence: string }[]
  radar: { id: string; label: string; value: number | null }[]
  activationIndex: number | null
}
