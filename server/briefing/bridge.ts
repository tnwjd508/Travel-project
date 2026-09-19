import { createInterface } from 'node:readline'
import { createBriefingService } from './service.js'
import { createBriefingBudget } from './budget.js'

// Keep the team's service instance alive: its cache, coalescing and two-job limit
// must survive individual FastAPI requests. Stdio never contains credentials.
const service = createBriefingService(process.env)
const budget = createBriefingBudget(globalThis.fetch)
globalThis.fetch = budget.fetch
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
lines.on('line', line => {
  void (async () => {
    let id: number | null = null
    try {
      const input = JSON.parse(line) as { id: number; method: string; query: [string, string][] }
      if (!Number.isSafeInteger(input.id)) return
      id = input.id
      if (typeof input.method !== 'string' || !Array.isArray(input.query) || input.query.some(pair => !Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== 'string'))) throw new Error('Invalid message')
      const result = await budget.run(() => service(input.method, new URLSearchParams(input.query)))
      process.stdout.write(JSON.stringify({ id, ...result }) + '\n')
    } catch {
      process.stdout.write(JSON.stringify({ id, status: 502, body: { message: '월간 브리핑 처리 중 오류가 발생했습니다.' } }) + '\n')
    }
  })()
})
// The parent owns this worker. Do not leave network jobs behind when it exits.
lines.on('close', () => process.exit(0))
