import type { TourApiEndpoint } from '../../server/tourApi'

export interface TourApiItem {
  contentid?: string
  contenttypeid?: string
  title?: string
  addr1?: string
  addr2?: string
  areacode?: string
  sigungucode?: string
  firstimage?: string
  firstimage2?: string
  mapx?: string
  mapy?: string
  tel?: string
  eventstartdate?: string
  eventenddate?: string
  [key: string]: string | undefined
}

interface TourApiHeader {
  resultCode: string
  resultMsg: string
}

interface TourApiBody<T> {
  items?: { item: T[] | T }
  numOfRows: number
  pageNo: number
  totalCount: number
}

interface TourApiEnvelope<T> {
  response: {
    header: TourApiHeader
    body: TourApiBody<T>
  }
}

export interface TourApiListResult<T> {
  items: T[]
  totalCount: number
  pageNo: number
  numOfRows: number
}

export class TourApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'TourApiError'
  }
}

export async function requestTourApi<T extends TourApiItem>(
  endpoint: TourApiEndpoint,
  parameters: Record<string, string | number | undefined> = {},
): Promise<TourApiListResult<T>> {
  const query = new URLSearchParams({ endpoint })
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined) query.set(key, String(value))
  }

  const response = await fetch(`/api/tourism?${query.toString()}`, {
    headers: { Accept: 'application/json' },
  })

  let payload: TourApiEnvelope<T> | { message?: string }
  try {
    payload = await response.json() as TourApiEnvelope<T> | { message?: string }
  } catch {
    throw new TourApiError('TourAPI 응답을 해석할 수 없습니다.')
  }

  if (!response.ok) {
    throw new TourApiError('message' in payload && payload.message
      ? payload.message
      : 'TourAPI 요청에 실패했습니다.')
  }

  if (!('response' in payload)) {
    throw new TourApiError('올바르지 않은 TourAPI 응답입니다.')
  }

  const { header, body } = payload.response
  if (header.resultCode !== '0000') {
    throw new TourApiError(header.resultMsg || 'TourAPI가 오류를 반환했습니다.', header.resultCode)
  }

  const rawItems = body.items?.item
  return {
    items: rawItems ? (Array.isArray(rawItems) ? rawItems : [rawItems]) : [],
    totalCount: body.totalCount ?? 0,
    pageNo: body.pageNo ?? 1,
    numOfRows: body.numOfRows ?? 0,
  }
}

// 광주광역시 지역코드(5)를 기준으로 대표 관광 콘텐츠를 조회합니다.
export function getGwangjuTourismList(pageNo = 1, numOfRows = 20) {
  return requestTourApi<TourApiItem>('areaBasedList2', {
    areaCode: 5,
    pageNo,
    numOfRows,
    arrange: 'C',
  })
}

export function checkTourApiConnection() {
  return requestTourApi<TourApiItem>('areaCode2', { pageNo: 1, numOfRows: 1 })
}
