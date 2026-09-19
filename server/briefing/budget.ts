import { AsyncLocalStorage } from 'node:async_hooks'

// Adapter-side guard: no changes to the teammate's collector or graph.
// Counters belong to this worker, not a distributed/provider-wide quota ledger.
export function createBriefingBudget(fetcher: typeof fetch, now = Date.now, limits = { request: 80, daily: 900 }) {
  const context = new AsyncLocalStorage<{ calls: number }>()
  const usage = new Map<string, { day: string; calls: number }>()
  const guarded: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.hostname !== 'apis.data.go.kr') return fetcher(input, init)
    const job = context.getStore()
    if (!job || job.calls >= limits.request) throw new Error('월간 브리핑 API 호출 예산에 도달했습니다.')
    const day = new Date(now()).toISOString().slice(0, 10)
    const counter = usage.get(url.pathname)
    const used = counter?.day === day ? counter.calls : 0
    if (used >= limits.daily) throw new Error('월간 브리핑 일일 API 호출 예산에 도달했습니다.')
    job.calls++
    usage.set(url.pathname, { day, calls: used + 1 })
    return fetcher(input, { ...init, redirect: 'error' })
  }
  return { fetch: guarded, run: <T>(task: () => Promise<T>) => context.run({ calls: 0 }, task) }
}
