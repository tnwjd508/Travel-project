export interface StoredVisitorMonth {
  ym: string
  total: number
  local: number
  outside: number
  foreign: number
  observedDays: number
  expectedDays: number
  through: string
  sourceFetchedAt: string
}

export interface VisitorMonthCache {
  get(regionId: string, districtId: string, ym: string): Promise<StoredVisitorMonth | null>
}

export function createVisitorMonthCache(environment: Record<string, string | undefined>, fetcher: typeof fetch = globalThis.fetch): VisitorMonthCache | null {
  const secret = environment.SUPABASE_SECRET_KEY?.trim() || environment.SUPABASE_SERVICE_ROLE_KEY?.trim()
  let base: URL
  try { base = new URL(environment.SUPABASE_URL || '') } catch { return null }
  if (!secret || base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') return null
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: secret }
  if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`
  return {
    async get(regionId, districtId, ym) {
      if (!/^[a-z][a-z-]{1,40}$/.test(regionId) || !/^\d{5}$/.test(districtId) || !/^20\d{2}(0[1-9]|1[0-2])$/.test(ym)) return null
      try {
        const response = await fetcher(new URL('/rest/v1/rpc/visitor_months_get', base), {
          method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(8000),
          body: JSON.stringify({ p_region_id: regionId, p_district_id: districtId,
            p_months: [`${ym.slice(0, 4)}-${ym.slice(4)}-01`] }),
        })
        if (!response.ok) return null
        const rows = await response.json() as unknown
        if (!Array.isArray(rows) || rows.length !== 1) return null
        const row = rows[0] as Record<string, unknown>
        const numeric = ['total', 'local', 'outside', 'foreign'].map(key => Number(row[key]))
        if (row.ym !== ym || row.complete !== true || numeric.some(value => !Number.isFinite(value) || value < 0)
          || !Number.isInteger(row.observedDays) || !Number.isInteger(row.expectedDays)
          || row.observedDays !== row.expectedDays || typeof row.through !== 'string'
          || typeof row.sourceFetchedAt !== 'string' || !Number.isFinite(Date.parse(row.sourceFetchedAt))) return null
        return { ym, total: numeric[0], local: numeric[1], outside: numeric[2], foreign: numeric[3],
          observedDays: row.observedDays as number, expectedDays: row.expectedDays as number,
          through: row.through, sourceFetchedAt: row.sourceFetchedAt }
      } catch { return null }
    },
  }
}
