import { handleRegions } from '../server/regions.js'

interface Response {
  status(code: number): Response
  setHeader(name: string, value: string): void
  json(body: unknown): void
}
export default function handler(request: { method?: string }, response: Response) {
  const result = handleRegions(request.method)
  for (const [key, value] of Object.entries(result.headers)) response.setHeader(key, value)
  return response.status(result.status).json(result.body)
}
