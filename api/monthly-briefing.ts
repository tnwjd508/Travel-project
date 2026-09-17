import { createBriefingService } from '../server/briefing/service.js'

// 개발 서버와 배포 서버가 동일한 검증·캐시·LangGraph 코드를 호출합니다.
const service = createBriefingService(process.env)
interface ApiRequest { method?: string; query: Record<string, string | string[] | undefined> }
interface ApiResponse {
  status(code: number): ApiResponse
  setHeader(name: string, value: string): void
  json(body: unknown): void
}
export default async function handler(request: ApiRequest, response: ApiResponse) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(request.query)) {
    if (typeof value === 'string') query.set(key, value)
    else if (Array.isArray(value)) value.forEach(item => query.append(key, item))
  }
  const result = await service(request.method, query)
  response.setHeader('Cache-Control', 'no-store')
  if (result.status === 405) response.setHeader('Allow', 'GET')
  if (result.status === 429) response.setHeader('Retry-After', '30')
  return response.status(result.status).json(result.body)
}
