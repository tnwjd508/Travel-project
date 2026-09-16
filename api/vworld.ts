import {
  CACHE_CONTROL,
  getProxyDistrict,
  requestDistrictLegalDongs,
} from '../server/vworld.js'

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

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ message: 'GET 요청만 지원합니다.' })
  }

  const rawDistrict = request.query.district
  const district = getProxyDistrict(Array.isArray(rawDistrict) ? rawDistrict[0] : rawDistrict)
  if (!district) {
    return response.status(400).json({ message: '지원하지 않는 자치구입니다.', code: 'UNKNOWN_DISTRICT' })
  }

  const apiKey = process.env.VWORLD_API_KEY
  const domain = process.env.VWORLD_DOMAIN
  if (!apiKey || !domain) {
    return response.status(503).json({
      message: 'VWORLD_API_KEY 또는 VWORLD_DOMAIN 환경변수가 설정되지 않았습니다.',
      code: 'MISSING_KEY',
    })
  }

  try {
    const result = await requestDistrictLegalDongs(district, apiKey, domain)
    response.setHeader('Content-Type', result.contentType)
    if (result.status === 200) response.setHeader('Cache-Control', CACHE_CONTROL)
    return response.status(result.status).send(result.body)
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'VWorld 응답 시간이 초과되었습니다.'
      : 'VWorld 요청 중 오류가 발생했습니다.'
    return response.status(502).json({ message, code: 'PROXY_ERROR' })
  }
}
