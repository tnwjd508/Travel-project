import { proxyFastApi, type ApiRequest, type ApiResponse } from '../../../server/fastApiProxy.js'

export default function handler(request: ApiRequest, response: ApiResponse) {
  const id = request.query.id
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    response.setHeader('Cache-Control', 'no-store')
    return response.status(400).json({ code: 'INVALID_PARAMETER', message: '저장 식별자를 확인하세요.' })
  }
  return proxyFastApi(`/api/scenarios/${id}/reviews`, request, response, ['id'], 65000)
}
