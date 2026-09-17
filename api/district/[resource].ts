import { handleDistrictHttp } from '../../server/districtHttp.js'

interface ApiRequest { method?: string; query: Record<string, string | string[] | undefined> }
interface ApiResponse { status(code: number): ApiResponse; setHeader(name: string, value: string): void; json(body: unknown): void }
export default async function handler(request: ApiRequest, response: ApiResponse) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(request.query)) {
    if (key === 'resource' || value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item)
  }
  const resource = typeof request.query.resource === 'string' ? request.query.resource : ''
  const result = await handleDistrictHttp({ method: request.method, resource, params }, process.env)
  for (const [key, value] of Object.entries(result.headers)) response.setHeader(key, value)
  response.status(result.status).json(result.body)
}
