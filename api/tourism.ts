import {
  isTourApiEndpoint,
  requestTourApi,
} from '../server/tourApi.js'

interface ApiRequest {
  method?: string
  query: Record<string, string | string[] | undefined>
}

interface ApiResponse {
  status(code: number): ApiResponse
  setHeader(name: string, value: string): void
  send(body: string): void
  json(body: unknown): void
}

function toSearchParams(query: ApiRequest['query']) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (key === 'endpoint' || value === undefined) continue
    params.set(key, Array.isArray(value) ? value[0] : value)
  }
  return params
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ message: 'GET 요청만 지원합니다.' })
  }

  const rawEndpoint = request.query.endpoint
  const endpoint = Array.isArray(rawEndpoint) ? rawEndpoint[0] : rawEndpoint ?? 'areaCode2'
  if (!isTourApiEndpoint(endpoint)) {
    return response.status(400).json({ message: '지원하지 않는 TourAPI 기능입니다.' })
  }

  const serviceKey = process.env.TOUR_API_SERVICE_KEY
  if (!serviceKey) {
    return response.status(503).json({
      message: 'TOUR_API_SERVICE_KEY 환경변수가 설정되지 않았습니다.',
    })
  }

  try {
    const result = await requestTourApi(endpoint, toSearchParams(request.query), serviceKey)
    response.setHeader('Content-Type', result.contentType)
    return response.status(result.status).send(result.body)
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'TourAPI 응답 시간이 초과되었습니다.'
      : 'TourAPI 요청 중 오류가 발생했습니다.'
    return response.status(502).json({ message })
  }
}
