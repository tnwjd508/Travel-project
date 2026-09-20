import { proxyFastApi, type ApiRequest, type ApiResponse } from '../../server/fastApiProxy.js'

export default function handler(request: ApiRequest, response: ApiResponse) {
  return proxyFastApi('/api/scenarios', request, response)
}
