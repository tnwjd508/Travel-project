// 브라우저와 서버가 같은 응답 규격을 사용하되 API 키는 포함하지 않습니다.
export interface BriefingEvidence {
  id: string
  sourceId: string
  label: string
  value: string
  period: string
  note: string
}

export interface BriefingSource {
  id: string
  label: string
  endpoint: string
  status: 'ready' | 'empty' | 'partial' | 'error'
  count: number
  note: string
}

export interface BriefingFinding {
  title: string
  description: string
  evidenceIds: string[]
}

export interface BriefingDiagnosis {
  summary: string
  summaryEvidenceIds: string[]
  findings: BriefingFinding[]
  recommendations: BriefingFinding[]
  limitations: string[]
}

export interface BriefingFestival {
  id: string
  title: string
  address: string
  startDate: string
  endDate: string
}

export interface MonthlyBriefingData {
  storage?: { savedAt: string }
  district: string
  districtName: string
  month: string
  generatedAt: string
  festivalAsOf: string
  aiStatus: 'ready' | 'partial' | 'unavailable'
  diagnosis: BriefingDiagnosis | null
  evidence: BriefingEvidence[]
  sources: BriefingSource[]
  festivals: { recent: BriefingFestival[]; upcoming: BriefingFestival[] }
  steps: { sourceId: string; status: 'merged' | 'skipped' | 'failed' }[]
  warnings: string[]
}

export interface BriefingStatusResponse {
  state: 'missing' | 'generating' | 'busy' | 'failed' | 'interrupted' | 'error'
  code: string
  message: string
  retryAfter?: number
  snapshot?: MonthlyBriefingData
}
