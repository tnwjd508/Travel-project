import { createHash } from 'node:crypto'

export interface TourismPage { rows: Record<string, unknown>[]; total: number }
export interface CachedTourismPage extends TourismPage { fetchedAt: string; age: number }
export interface TourismPageCache {
  get(operation: string, params: Record<string, string>): Promise<CachedTourismPage | null>
  store(operation: string, params: Record<string, string>, page: TourismPage): Promise<void>
}

const version = 1
const canonical = (params: Record<string, string>) => JSON.stringify(Object.fromEntries(Object.entries(params).sort()))
export const tourismCacheKey = (operation: string, params: Record<string, string>) => {
  const value = canonical(params)
  if (new TextEncoder().encode(value).length > 4000) throw new Error('cache parameters too long')
  return createHash('sha256').update(`v${version}\n${operation}\n${value}`).digest('hex')
}

function page(value: unknown): TourismPage | null {
  if (!value || typeof value !== 'object') return null
  const data = value as { items?: unknown; totalCount?: unknown }
  if (!Array.isArray(data.items) || data.items.length > 1000 || data.items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) return null
  if (!Number.isSafeInteger(data.totalCount) || Number(data.totalCount) < data.items.length) return null
  return { rows: data.items as Record<string, unknown>[], total: Number(data.totalCount) }
}

export function createTourismApiCache(environment: Record<string, string | undefined>, fetcher: typeof fetch = globalThis.fetch): TourismPageCache | null {
  const secret = environment.SUPABASE_SECRET_KEY?.trim() || environment.SUPABASE_SERVICE_ROLE_KEY?.trim()
  let base: URL
  try { base = new URL(environment.SUPABASE_URL || '') } catch { return null }
  if (!secret || base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') return null
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: secret }
  if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`
  const rpc = async (name: string, body: Record<string, unknown>) => {
    const response = await fetcher(new URL(`/rest/v1/rpc/${name}`, base), {
      method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(8000), body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error('cache unavailable')
    return response.json() as Promise<unknown>
  }
  return {
    async get(operation, params) {
      try {
        const value = await rpc('tourism_cache_get', { p_request_sha256: tourismCacheKey(operation, params),
          p_operation: operation, p_request_params: params, p_schema_version: version }) as { state?: unknown; payload?: unknown; fetchedAt?: unknown }
        if (value.state === 'missing') return null
        const parsed = value.state === 'stored' ? page(value.payload) : null
        const fetchedAt = typeof value.fetchedAt === 'string' ? value.fetchedAt : ''
        const fetched = Date.parse(fetchedAt)
        if (!parsed || !Number.isFinite(fetched)) return null
        return { ...parsed, fetchedAt, age: Math.max(0, (Date.now() - fetched) / 1000) }
      } catch { return null }
    },
    async store(operation, params, value) {
      try {
        await rpc('tourism_cache_store', { p_request_sha256: tourismCacheKey(operation, params),
          p_operation: operation, p_request_params: params,
          p_response_payload: { items: value.rows, totalCount: value.total },
          p_source_fetched_at: new Date().toISOString(), p_schema_version: version })
      } catch { /* A cache outage must not discard a valid source response. */ }
    },
  }
}
