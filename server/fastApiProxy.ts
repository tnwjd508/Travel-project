export interface ApiRequest { method?: string; query: Record<string, string | string[] | undefined>; headers?: Record<string, string | string[] | undefined>; body?: unknown }
export interface ApiResponse { status(code: number): ApiResponse; setHeader(name: string, value: string): void; json(body: unknown): void }

export async function proxyFastApi(path: string, request: ApiRequest, response: ApiResponse, omit: string[] = [], timeoutMs = 30000) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  const privateRequest = path.startsWith('/api/account/') || path === '/api/scenarios' || path.startsWith('/api/scenarios/') || path.startsWith('/api/scenario-reviews/')
  const reviewWrite = /^\/api\/scenarios\/[0-9a-f-]{36}\/reviews$/.test(path)
  const allowed = path === '/api/monthly-briefing' || path === '/api/scenarios' || reviewWrite ? ['GET', 'POST'] : ['GET']
  if (!allowed.includes(request.method ?? '')) {
    response.setHeader('Allow', allowed.join(', '))
    return response.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: `${allowed.join(', ')} 요청만 지원합니다.` })
  }
  const origin = process.env.FASTAPI_BASE_URL
  if (!origin) return response.status(503).json({ code: 'MISSING_BACKEND', message: 'FASTAPI_BASE_URL 환경변수가 필요합니다.' })
  try {
    const url = new URL(path, origin)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid origin')
    if (privateRequest && url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('HTTPS required for authenticated requests')
    for (const [key, raw] of Object.entries(request.query)) {
      if (raw === undefined || omit.includes(key)) continue
      for (const value of Array.isArray(raw) ? raw : [raw]) url.searchParams.append(key, value)
    }
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (process.env.FASTAPI_PROXY_TOKEN) headers['X-Ongil-Proxy-Token'] = process.env.FASTAPI_PROXY_TOKEN
    let requestBody: string | undefined
    if (privateRequest) {
      for (const name of ['authorization', 'idempotency-key']) {
        const value = request.headers?.[name]
        if (typeof value === 'string') headers[name] = value
      }
      if (request.method === 'POST') {
        headers['Content-Type'] = 'application/json'
        requestBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {})
        if (Buffer.byteLength(requestBody, 'utf8') > 16384) return response.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: '저장 요청이 너무 큽니다.' })
      }
    }
    const upstream = await fetch(url, { method: request.method, headers, body: requestBody, signal: AbortSignal.timeout(timeoutMs), redirect: 'error' })
    const body: unknown = await upstream.json()
    if (upstream.status === 429) response.setHeader('Retry-After', upstream.headers.get('retry-after') ?? '30')
    if (upstream.status === 202) response.setHeader('Retry-After', upstream.headers.get('retry-after') ?? '5')
    if (upstream.ok && !privateRequest) response.setHeader('Cache-Control', upstream.headers.get('cache-control') ?? 'no-store')
    return response.status(upstream.status).json(body)
  } catch {
    return response.status(502).json({ code: 'BACKEND_UNAVAILABLE', message: 'FastAPI 데이터 서버에 연결할 수 없습니다.' })
  }
}
