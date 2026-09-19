import { proxyFastApi, type ApiRequest, type ApiResponse } from '../server/fastApiProxy.js'

// FastAPI owns the persistent worker; the teammate's LangGraph service is unchanged.
export default function handler(request: ApiRequest, response: ApiResponse) {
  return proxyFastApi('/api/monthly-briefing', request, response, [], 255000)
}
