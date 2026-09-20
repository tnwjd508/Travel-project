import { proxyFastApi, type ApiRequest, type ApiResponse } from '../../server/fastApiProxy.js'

export default function handler(request: ApiRequest, response: ApiResponse) {
  const action = request.query.action
  if (action !== 'config' && action !== 'organizations') {
    response.setHeader('Cache-Control', 'no-store')
    return response.status(404).json({ code: 'NOT_FOUND', message: '요청한 경로가 없습니다.' })
  }
  return proxyFastApi(`/api/account/${action}`, request, response, ['action'])
}
