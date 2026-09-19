import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scenarioRequest, type SavedScenario } from '@/lib/scenarioClient'
import { baselineStatusLabels, reviewDetailSchema, reviewPageSchema, type ReviewListItem } from '@/lib/reviewClient'
import { evidenceStatusLabels } from '@/data/festivalEffect'

export function ScenarioReviews({ client, scenario, canWrite }: { client: SupabaseClient; scenario: SavedScenario; canWrite: boolean }) {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<ReviewListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const retryKey = useRef<string | null>(null)
  const lock = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    scenarioRequest(client, `/api/scenarios/${scenario.id}/reviews?organizationId=${scenario.organization_id}`, reviewPageSchema, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setItems(data.items); setCursor(data.nextCursor) } })
      .catch(err => { if (!controller.signal.aborted) setError(err.message) })
    return () => { alive.current = false; controller.abort() }
  }, [client, scenario.id, scenario.organization_id])
  function open(id: string) {
    setParams(previous => { const next = new URLSearchParams(previous); next.set('organization', scenario.organization_id); next.set('scenario', scenario.id); next.set('review', id); return next })
  }
  async function create() {
    if (!canWrite || lock.current) return
    lock.current = true; setBusy(true); setError('')
    retryKey.current ??= crypto.randomUUID()
    try {
      const data = await scenarioRequest(client, `/api/scenarios/${scenario.id}/reviews`, reviewDetailSchema, {
        method: 'POST', headers: { 'Idempotency-Key': retryKey.current }, body: JSON.stringify({ organizationId: scenario.organization_id }),
      })
      if (!alive.current) return
      retryKey.current = null
      setItems(previous => [data.review, ...previous.filter(item => item.id !== data.review.id)])
      open(data.review.id)
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : '검토 저장에 실패했습니다.') }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  async function more() {
    if (!cursor || lock.current) return
    lock.current = true; setBusy(true)
    try {
      const query = new URLSearchParams({ organizationId: scenario.organization_id, cursor })
      const data = await scenarioRequest(client, `/api/scenarios/${scenario.id}/reviews?${query}`, reviewPageSchema)
      if (alive.current) { setItems(previous => [...previous, ...data.items]); setCursor(data.nextCursor) }
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : '기록 조회에 실패했습니다.') }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  return <section className="mt-5 border-t border-blue-100 pt-4" aria-label="저장된 검토">
    <h5 className="text-sm font-bold">검토 기록</h5>
    <p className="mt-2 text-xs leading-5 text-slate-500">저장된 조건으로 지표와 분석 근거를 수집합니다. 저장 시점의 자료는 전략 비교와 보고서에서도 함께 열립니다.</p>
    <button className="mt-3 min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!canWrite || busy} onClick={() => void create()}>{busy ? '자료 확인 중…' : retryKey.current ? '같은 요청으로 저장 재시도' : '현재 자료로 검토 저장'}</button>
    {error && <p role="alert" className="mt-3 text-xs text-amber-800">{error}</p>}
    <ul className="mt-4 space-y-2">{items.map(item => <li key={item.id}><button onClick={() => open(item.id)} className={`w-full rounded-lg border p-3 text-left ${params.get('review') === item.id ? 'border-blue-400 bg-white' : 'border-slate-200'}`}>
      <p className="text-xs font-semibold">{new Date(item.created_at).toLocaleString('ko-KR')}</p><p className="mt-1 text-xs text-slate-500">{baselineStatusLabels[item.baseline_status]} · {evidenceStatusLabels[item.reference_status]}</p>
    </button></li>)}</ul>
    {cursor && <button disabled={busy} onClick={() => void more()} className="min-h-11 text-xs text-blue-700">이전 검토 더 보기</button>}
  </section>
}
