import type { SummaryResponse, VisitorsResponse, IndicesResponse, ContentsResponse, FestivalsResponse, RelatedResponse, RankResponse, DiagnosisResponse } from '@/types/district'

export interface DistrictResources {
  summary: SummaryResponse; visitors: VisitorsResponse; indices: IndicesResponse; contents: ContentsResponse
  festivals: FestivalsResponse; related: RelatedResponse; rank: RankResponse; diagnosis: DiagnosisResponse
}
export type DistrictResource = keyof DistrictResources
export class DistrictApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
const cache = new Map<string, { until: number; data: DistrictResources[DistrictResource] }>()
export async function districtRequest<R extends DistrictResource>(resource: R, query: string, signal: AbortSignal, refresh = false): Promise<DistrictResources[R]> {
  const key = `${resource}?${query}`
  const cached = cache.get(key)
  if (!refresh && cached && cached.until > Date.now()) return cached.data as DistrictResources[R]
  let response: Response
  try { response = await fetch(`/api/district/${key}`, { signal, headers: { Accept: 'application/json' } }) }
  catch (error) {
    if (signal.aborted) throw error
    throw new DistrictApiError(0, 'CONNECTION_ERROR', '데이터 서버에 연결할 수 없습니다.')
  }
  let body: DistrictResources[R] & { code?: string; message?: string }
  try { body = await response.json() } catch { throw new DistrictApiError(response.status, 'INVALID_RESPONSE', '데이터 서버 응답을 확인하세요.') }
  if (!response.ok) throw new DistrictApiError(response.status, body.code ?? 'API_ERROR', body.message ?? '관광 데이터를 불러오지 못했습니다.')
  if (!body || typeof body !== 'object' || typeof body.baseYm !== 'string' || !Array.isArray(body.warnings)) throw new DistrictApiError(502, 'INVALID_RESPONSE', '데이터 응답 형식이 올바르지 않습니다.')
  if (cache.size >= 80) cache.delete(cache.keys().next().value!)
  cache.set(key, { data: body, until: Date.now() + 60000 })
  return body
}
