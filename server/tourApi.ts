export const TOUR_API_BASE_URL = 'https://apis.data.go.kr/B551011/KorService2'

export const TOUR_API_ENDPOINTS = [
  'areaCode2',
  'areaBasedList2',
  'locationBasedList2',
  'searchKeyword2',
  'searchFestival2',
  'searchStay2',
  'detailCommon2',
  'detailIntro2',
  'detailInfo2',
  'detailImage2',
  'ldongCode2',
] as const

export type TourApiEndpoint = (typeof TOUR_API_ENDPOINTS)[number]

const allowedEndpoints = new Set<string>(TOUR_API_ENDPOINTS)

// 클라이언트가 serviceKey나 API 호스트를 덮어쓰지 못하도록 전달 가능한 파라미터를 제한합니다.
const allowedParameters = new Set([
  'numOfRows', 'pageNo', 'arrange', 'contentTypeId', 'areaCode', 'sigunguCode',
  'cat1', 'cat2', 'cat3', 'mapX', 'mapY', 'radius', 'keyword',
  'eventStartDate', 'eventEndDate', 'contentId', 'defaultYN', 'firstImageYN',
  'areacodeYN', 'catcodeYN', 'addrinfoYN', 'mapinfoYN', 'overviewYN',
  'imageYN', 'subContentId', 'lDongRegnCd', 'lDongSignguCd', 'lDongListYn',
  'modifiedtime', 'showflag',
])

export interface TourApiProxyResult {
  status: number
  contentType: string
  body: string
}

export function isTourApiEndpoint(value: string): value is TourApiEndpoint {
  return allowedEndpoints.has(value)
}

export function buildTourApiUrl(
  endpoint: TourApiEndpoint,
  input: URLSearchParams,
  serviceKey: string,
) {
  const url = new URL(`${TOUR_API_BASE_URL}/${endpoint}`)

  // 공공데이터포털에서 제공하는 Encoding/Decoding 인증키를 모두 허용합니다.
  // Encoding 키는 먼저 한 번 복원한 뒤 URLSearchParams가 안전하게 인코딩합니다.
  const trimmedServiceKey = serviceKey.trim()
  let normalizedServiceKey = trimmedServiceKey
  if (/%[0-9A-Fa-f]{2}/.test(trimmedServiceKey)) {
    try {
      normalizedServiceKey = decodeURIComponent(trimmedServiceKey)
    } catch {
      normalizedServiceKey = trimmedServiceKey
    }
  }
  url.searchParams.set('serviceKey', normalizedServiceKey)
  url.searchParams.set('MobileOS', 'WEB')
  url.searchParams.set('MobileApp', 'ONGIL')
  url.searchParams.set('_type', 'json')

  for (const [key, value] of input.entries()) {
    if (allowedParameters.has(key) && value) url.searchParams.set(key, value)
  }

  return url
}

export async function requestTourApi(
  endpoint: TourApiEndpoint,
  input: URLSearchParams,
  serviceKey: string,
): Promise<TourApiProxyResult> {
  const url = buildTourApiUrl(endpoint, input, serviceKey)
  const response = await fetch(url, {
    headers: { Accept: 'application/json, application/xml;q=0.8' },
    signal: AbortSignal.timeout(12_000),
  })

  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? 'application/json; charset=utf-8',
    body: await response.text(),
  }
}
