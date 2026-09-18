import { proxyFastApi } from '../../server/fastApiProxy.js'

interface ApiRequest { method?: string; query: Record<string, string | string[] | undefined> }
interface ApiResponse { status(code: number): ApiResponse; setHeader(name: string, value: string): void; json(body: unknown): void }
export default async function handler(request: ApiRequest, response: ApiResponse) {
  const resource = typeof request.query.resource === 'string' ? request.query.resource : ''
  if (request.method === 'GET' && Object.values(request.query).some(Array.isArray)) {
    response.setHeader('Cache-Control', 'no-store')
    return response.status(400).json({ code: 'INVALID_PARAMETER', message: '중복된 파라미터입니다.' })
  }
  return proxyFastApi(`/api/district/${encodeURIComponent(resource)}`, request, response, ['resource'])
}
