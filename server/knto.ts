import { createHash } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public resultCode?: string) {
    super(message)
  }
}
export type Row = Record<string, unknown>
export interface Page { items: Row[]; totalCount: number }
const operations = {
  'KorService2/areaBasedList2': ['lDongRegnCd', 'lDongSignguCd', 'contentTypeId', 'arrange'],
  'KorService2/searchFestival2': ['lDongRegnCd', 'lDongSignguCd', 'eventStartDate', 'eventEndDate', 'arrange'],
  'DataLabService/locgoRegnVisitrDDList': ['startYmd', 'endYmd'],
  'AreaTarDemDsService/areaTarSjrnDsList': ['baseYm', 'areaCd', 'signguCd', 'tarSjrnDsIxCd'],
  'AreaTarDemDsService/areaTarExpDsList': ['baseYm', 'areaCd', 'signguCd', 'tarExpDsIxCd'],
  'AreaTarDivService/areaTouDivList': ['baseYm', 'areaCd', 'signguCd', 'touDivIxCd'],
  'AreaTarDivService/areaExpDivList': ['baseYm', 'areaCd', 'signguCd', 'expDivIxCd'],
  'AreaTarDivService/areaIntlDivList': ['baseYm', 'areaCd', 'signguCd', 'intlDivIxCd'],
  'AreaTarResDemService/areaTarSvcDemList': ['baseYm', 'areaCd', 'signguCd', 'tarSvcDemIxCd'],
  'AreaTarResDemService/areaCulResDemList': ['baseYm', 'areaCd', 'signguCd', 'culResDemIxCd'],
  'TarRlteTarService1/areaBasedList1': ['baseYm', 'areaCd', 'signguCd'],
} as const
export type Operation = keyof typeof operations

interface RequestBudget { calls: number; maximum: number; signal: AbortSignal }
const requestBudget = new AsyncLocalStorage<RequestBudget>()
export function withRequestBudget<T>(load: () => Promise<T>, maximum = 80, timeoutMs = 25000): Promise<T> {
  return requestBudget.run({ calls: 0, maximum, signal: AbortSignal.timeout(timeoutMs) }, load)
}

export function buildKntoUrl(operation: Operation, params: Record<string, string>, key: string) {
  if (!Object.hasOwn(operations, operation)) throw new ApiError(400, 'INVALID_OPERATION', '지원하지 않는 API입니다.')
  let normalized = key.trim()
  try { normalized = decodeURIComponent(normalized) } catch { /* already decoded */ }
  const url = new URL(`https://apis.data.go.kr/B551011/${operation}`)
  url.search = new URLSearchParams({ serviceKey: normalized, MobileOS: 'ETC', MobileApp: 'ONGIL', _type: 'json' }).toString()
  const allowed = new Set<string>([...operations[operation], 'pageNo', 'numOfRows'])
  for (const [name, value] of Object.entries(params)) {
    if (!allowed.has(name)) throw new ApiError(400, 'INVALID_PARAMETER', '허용되지 않는 API 파라미터입니다.')
    url.searchParams.set(name, value)
  }
  return url
}

const malformed = () => new ApiError(502, 'INVALID_UPSTREAM', '관광 API 응답 형식이 올바르지 않습니다.')
export function parseKntoResponse(text: string): Page {
  let json: { response?: { header?: { resultCode?: unknown }; body?: { items?: { item?: unknown } | string; totalCount?: unknown } } }
  try { json = JSON.parse(text) } catch {
    const code = text.match(/<(?:returnReasonCode|resultCode)>\s*([A-Za-z0-9_-]{1,16})\s*</)?.[1]
    throw new ApiError(502, 'UPSTREAM_ERROR', '관광 API가 정상 데이터를 반환하지 않았습니다.', code)
  }
  const code = String(json?.response?.header?.resultCode ?? '')
  if (!['0000', '00'].includes(code)) {
    throw new ApiError(502, 'UPSTREAM_ERROR', '관광 API 요청이 실패했습니다.', /^[A-Za-z0-9_-]{1,16}$/.test(code) ? code : undefined)
  }
  const body = json.response?.body
  if (!body || body.totalCount === undefined || body.totalCount === null || body.totalCount === '') throw malformed()
  const totalCount = Number(body.totalCount)
  if (!Number.isSafeInteger(totalCount) || totalCount < 0) throw malformed()
  const raw = typeof body.items === 'object' && body.items !== null ? body.items.item : undefined
  const items = raw == null || raw === '' ? [] : Array.isArray(raw) ? raw : [raw]
  if (items.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw malformed()
  if (totalCount > 0 && items.length === 0) throw malformed()
  return { items: items as Row[], totalCount }
}

interface Freshness { fetchedAt: number; expiresAt: number }
const freshness = new AsyncLocalStorage<Freshness>()
function observe(entry: Freshness) {
  const current = freshness.getStore()
  if (current) { current.fetchedAt = Math.min(current.fetchedAt, entry.fetchedAt); current.expiresAt = Math.min(current.expiresAt, entry.expiresAt) }
}
export function sourceFetchedAt() {
  const observed = freshness.getStore()?.fetchedAt
  return new Date(observed !== undefined && Number.isFinite(observed) ? observed : Date.now()).toISOString()
}
export async function withFreshness<T>(load: () => Promise<T>) {
  const state = { fetchedAt: Infinity, expiresAt: Infinity }
  const value = await freshness.run(state, load)
  return { value, remainingSeconds: Math.max(0, Math.floor((state.expiresAt - Date.now()) / 1000)) }
}

// Composite cache entries inherit the oldest source timestamp and earliest expiry.
// This prevents nested cache + CDN TTLs from extending source freshness past one day.
export class MemoCache {
  private values = new Map<string, Freshness & { value: unknown }>()
  private pending = new Map<string, Promise<Freshness & { value: unknown }>>()
  constructor(private capacity = 256) {}
  async get<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const hit = this.values.get(key)
    if (hit && hit.expiresAt > Date.now()) { observe(hit); return hit.value as T }
    this.values.delete(key)
    const pending = this.pending.get(key)
    if (pending) { const entry = await pending; observe(entry); return entry.value as T }
    if (this.pending.size >= this.capacity) throw new ApiError(503, 'BUSY', '요청이 많습니다. 잠시 후 다시 시도하세요.')
    const state = { fetchedAt: Date.now(), expiresAt: Date.now() + Math.min(ttlSeconds > 0 ? ttlSeconds : 86400, 86400) * 1000 }
    const promise = freshness.run(state, async () => {
      const value = await load()
      const entry = { ...state, value }
      if (ttlSeconds > 0) {
        if (this.values.size >= this.capacity) this.values.delete(this.values.keys().next().value!)
        this.values.set(key, entry)
      }
      return entry
    }).finally(() => this.pending.delete(key))
    this.pending.set(key, promise)
    const entry = await promise
    observe(entry)
    return entry.value as T
  }
}

export class KntoClient {
  readonly scope: string
  private active = 0
  private waiters: (() => void)[] = []
  private cache = new MemoCache(512)
  private dailyCalls = new Map<string, { day: string; count: number }>()
  constructor(private key: string, private fetcher: typeof fetch = fetch) {
    this.scope = createHash('sha256').update(key).digest('hex')
  }
  private async acquire(signal: AbortSignal) {
    if (signal.aborted) throw new ApiError(502, 'REQUEST_TIMEOUT', '데이터 수집 시간 한도를 초과했습니다.')
    if (this.active < 6) { this.active++; return }
    await new Promise<void>((resolve, reject) => {
      const resume = () => { signal.removeEventListener('abort', abort); resolve() }
      const abort = () => {
        const index = this.waiters.indexOf(resume)
        if (index >= 0) this.waiters.splice(index, 1)
        reject(new ApiError(502, 'REQUEST_TIMEOUT', '데이터 수집 시간 한도를 초과했습니다.'))
      }
      this.waiters.push(resume)
      signal.addEventListener('abort', abort, { once: true })
    })
  }
  async page(operation: Operation, params: Record<string, string>, ttl = 86400): Promise<Page> {
    if (!this.key.trim()) throw new ApiError(503, 'MISSING_KEY', 'TOUR_API_SERVICE_KEY 환경변수가 필요합니다.')
    const url = buildKntoUrl(operation, params, this.key)
    const id = operation + JSON.stringify(Object.entries(params).sort())
    return this.cache.get(id, ttl, async () => {
      const budget = requestBudget.getStore()
      const signal = budget?.signal ?? AbortSignal.timeout(25000)
      await this.acquire(signal)
      try {
        if (signal.aborted) throw new ApiError(502, 'REQUEST_TIMEOUT', '데이터 수집 시간 한도를 초과했습니다.')
        if (budget && budget.calls >= budget.maximum) throw new ApiError(503, 'REQUEST_BUDGET', '요청별 외부 API 호출 한도에 도달했습니다.')
        const day = new Date().toISOString().slice(0, 10)
        let usage = this.dailyCalls.get(operation)
        if (!usage || usage.day !== day) { usage = { day, count: 0 }; this.dailyCalls.set(operation, usage) }
        if (usage.count >= 900) throw new ApiError(503, 'DAILY_BUDGET', '외부 API 호출 예산을 보호하기 위해 일시 중단했습니다.')
        usage.count++; if (budget) budget.calls++
        const response = await this.fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), redirect: 'error' })
        const text = await response.text()
        if (!response.ok) {
          try { parseKntoResponse(text) } catch (error) { if (error instanceof ApiError && error.resultCode) throw error }
          throw new ApiError(502, 'UPSTREAM_HTTP', '관광 API 서버 요청이 실패했습니다.')
        }
        return parseKntoResponse(text)
      } catch (error) {
        if (error instanceof ApiError) throw error
        if (signal.aborted) throw new ApiError(502, 'REQUEST_TIMEOUT', '데이터 수집 시간 한도를 초과했습니다.')
        throw new ApiError(502, 'UPSTREAM_UNAVAILABLE', '관광 API 연결 실패 또는 응답 시간 초과입니다.')
      } finally {
        // Transfer the occupied permit directly to the next waiter (no race window).
        const next = this.waiters.shift()
        if (next) next(); else this.active--
      }
    })
  }
  async all(operation: Operation, params: Record<string, string>, ttl = 86400, pageSize = 1000): Promise<Row[]> {
    const rows: Row[] = []
    let expected: number | undefined
    // 1,000 rows/page keeps visitor payloads bounded. Never silently truncate.
    for (let pageNo = 1; pageNo <= 100; pageNo++) {
      const page = await this.page(operation, { ...params, pageNo: String(pageNo), numOfRows: String(pageSize) }, ttl)
      if (expected !== undefined && expected !== page.totalCount) throw new ApiError(502, 'DATA_CHANGED', '조회 중 데이터가 변경되었습니다. 다시 조회하세요.')
      expected = page.totalCount
      rows.push(...page.items)
      if (rows.length === expected) return rows
      if (!page.items.length || rows.length > expected) throw malformed()
    }
    throw new ApiError(502, 'PAGE_LIMIT', '관광 API 전체 데이터를 수집하지 못했습니다.')
  }
}

export function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
