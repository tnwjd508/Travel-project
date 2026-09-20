import { proxyFastApi, type ApiRequest, type ApiResponse } from '../server/fastApiProxy.js'

export default function handler(request: ApiRequest, response: ApiResponse) {
  return proxyFastApi('/api/policy-evidence', request, response)
}
