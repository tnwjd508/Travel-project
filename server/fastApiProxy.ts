export interface ApiRequest { method?: string; query: Record<string, string | string[] | undefined> }
export interface ApiResponse { status(code: number): ApiResponse; setHeader(name: string, value: string): void; json(body: unknown): void }

export async function proxyFastApi(path: string, request: ApiRequest, response: ApiResponse, omit: string[] = []) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET 요청만 지원합니다.' })
  }
  const origin = process.env.FASTAPI_BASE_URL
  if (!origin) return response.status(503).json({ code: 'MISSING_BACKEND', message: 'FASTAPI_BASE_URL 환경변수가 필요합니다.' })
  try {
    const url = new URL(path, origin)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid origin')
    for (const [key, raw] of Object.entries(request.query)) {
      if (raw === undefined || omit.includes(key)) continue
      for (const value of Array.isArray(raw) ? raw : [raw]) url.searchParams.append(key, value)
    }
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (process.env.FASTAPI_PROXY_TOKEN) headers['X-Ongil-Proxy-Token'] = process.env.FASTAPI_PROXY_TOKEN
    const upstream = await fetch(url, { headers, signal: AbortSignal.timeout(30000), redirect: 'error' })
    const body: unknown = await upstream.json()
    if (upstream.ok) response.setHeader('Cache-Control', upstream.headers.get('cache-control') ?? 'no-store')
    return response.status(upstream.status).json(body)
  } catch {
    return response.status(502).json({ code: 'BACKEND_UNAVAILABLE', message: 'FastAPI 데이터 서버에 연결할 수 없습니다.' })
  }
}
