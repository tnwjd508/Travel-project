import { proxyFastApi, type ApiRequest, type ApiResponse } from '../server/fastApiProxy.js'

// FastAPI 워커가 기존 LangGraph와 월별 DB 저장 서비스를 실행합니다.
export default function handler(request: ApiRequest, response: ApiResponse) {
  return proxyFastApi('/api/monthly-briefing', request, response, [], 290000)
}
