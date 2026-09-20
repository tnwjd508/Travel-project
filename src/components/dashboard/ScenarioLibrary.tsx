import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ScenarioReviews } from './ScenarioReviews'
import { Card } from '@/components/ui/Card'
import { policyDurationMonths, type PolicyDuration, type PolicyId } from '@/data/policies'
import { requireTourismDistrict } from '@/data/tourismRegions'
import { accountClient, organizationsSchema, savedSchema, scenarioPageSchema, scenarioRequest, type Organization, type SavedScenario } from '@/lib/scenarioClient'
import type { MonthlyBriefingData } from '@/types/briefing'

type Props = { district: string; policy: PolicyId; budget: number; duration: PolicyDuration; onLoad: (saved: SavedScenario) => void; onClear: () => void }
const fieldClass = 'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900'
const buttonClass = 'min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50'
const initialMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date())

export function ScenarioLibrary({ district, policy, budget, duration, onLoad, onClear }: Props) {
  const canonical = requireTourismDistrict(district)
  const [params, setParams] = useSearchParams()
  const requestedOrg = params.get('organization')
  const requestedId = params.get('scenario')
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [initializing, setInitializing] = useState(true)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<SavedScenario[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<SavedScenario | null>(null)
  const [briefing, setBriefing] = useState<MonthlyBriefingData | null>(null)
  const [startMonth, setStartMonth] = useState(initialMonth)
  const [briefingMonth, setBriefingMonth] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const pending = useRef<{ body: string; key: string } | null>(null)
  const inFlight = useRef(false)
  const epoch = useRef(0)
  const onClearRef = useRef(onClear)
  onClearRef.current = onClear
  const organization = organizations.find(item => item.id === orgId)

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    accountClient().then(async value => {
      if (!active) return
      setClient(value)
      const subscription = value.auth.onAuthStateChange((_event, session) => {
        if (!active) return
        setUserId(session?.user.id ?? null)
      })
      unsubscribe = () => subscription.data.subscription.unsubscribe()
      const { data, error: sessionError } = await value.auth.getSession()
      if (sessionError) throw sessionError
      if (active) setUserId(data.session?.user.id ?? null)
    }).catch(() => { if (active) setError('공동 저장 서비스에 연결할 수 없습니다. 서버 설정을 확인한 뒤 다시 접속해 주세요.') })
      .finally(() => { if (active) setInitializing(false) })
    return () => { active = false; unsubscribe?.(); epoch.current++ }
  }, [])

  useEffect(() => {
    epoch.current++
    setOrganizations([]); setOrgId(''); setItems([]); setSelected(null); setBriefing(null); pending.current = null
    onClearRef.current()
    if (!client || !userId) return
    const controller = new AbortController()
    scenarioRequest(client, '/api/account/organizations', organizationsSchema, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return
      setOrganizations(data.organizations)
      setOrgId(data.organizations.find(item => item.id === requestedOrg)?.id ?? data.organizations[0]?.id ?? '')
    }).catch(err => { if (!controller.signal.aborted) setError(err.message) })
    return () => controller.abort()
    // A saved URL is resolved after authentication; changing the selection below is local.
  }, [client, userId])

  useEffect(() => {
    if (!requestedOrg || !organizations.length) return
    if (organizations.some(item => item.id === requestedOrg)) setOrgId(requestedOrg)
    else setError('현재 소속된 기관의 저장 주소를 열어 주세요.')
  }, [requestedOrg, organizations])

  useEffect(() => {
    onClearRef.current()
    setStartMonth(initialMonth()); setBriefingMonth('')
  }, [orgId])

  useEffect(() => {
    epoch.current++
    setItems([]); setSelected(null); setBriefing(null); setNextCursor(null); pending.current = null; setError('')
    if (!client || !userId || !orgId) return
    const controller = new AbortController()
    const query = new URLSearchParams({ organizationId: orgId, district: canonical.id })
    scenarioRequest(client, `/api/scenarios?${query}`, scenarioPageSchema, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setItems(data.items); setNextCursor(data.nextCursor) }
    }).catch(err => { if (!controller.signal.aborted) setError(err.message) })
    if (requestedId && requestedOrg === orgId) {
      scenarioRequest(client, `/api/scenarios/${encodeURIComponent(requestedId)}?organizationId=${orgId}`, savedSchema, { signal: controller.signal }).then(data => {
        if (data.district_id !== canonical.id) throw new Error('현재 지역과 저장된 시나리오의 지역이 다릅니다.')
        if (!controller.signal.aborted) setSelected(data)
      }).catch(err => { if (!controller.signal.aborted) setError(err.message) })
    }
    return () => controller.abort()
  }, [client, userId, orgId, canonical.id, reload, requestedId, requestedOrg])

  function open(saved: SavedScenario) {
    setParams(previous => { const next = new URLSearchParams(previous); next.set('organization', saved.organization_id); next.set('scenario', saved.id); next.delete('review'); return next })
  }

  async function save() {
    if (!client || !organization || organization.role === 'viewer' || inFlight.current) return
    const body = JSON.stringify({ organizationId: orgId, regionId: canonical.regionId, district: canonical.id,
      policy, budgetKrw: budget * 100000000, startMonth, durationMonths: policyDurationMonths[duration], briefingMonth: briefingMonth || null })
    if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() }
    const version = epoch.current
    inFlight.current = true; setBusy(true); setError('')
    try {
      const data = await scenarioRequest(client, '/api/scenarios', savedSchema, {
        method: 'POST', body, headers: { 'Idempotency-Key': pending.current.key },
      })
      if (version !== epoch.current) return
      pending.current = null
      open(data); setReload(value => value + 1)
    } catch (err) { if (version === epoch.current) setError(err instanceof Error ? err.message : '저장에 실패했습니다.') }
    finally { inFlight.current = false; setBusy(false) }
  }

  async function more() {
    if (!client || !nextCursor || inFlight.current) return
    const version = epoch.current
    inFlight.current = true; setBusy(true)
    try {
      const query = new URLSearchParams({ organizationId: orgId, district: canonical.id, cursor: nextCursor })
      const data = await scenarioRequest(client, `/api/scenarios?${query}`, scenarioPageSchema)
      if (version === epoch.current) { setItems(previous => [...previous, ...data.items]); setNextCursor(data.nextCursor) }
    } catch (err) { if (version === epoch.current) setError(err instanceof Error ? err.message : '목록 조회에 실패했습니다.') }
    finally { inFlight.current = false; setBusy(false) }
  }

  useEffect(() => {
    setBriefing(null)
    if (!selected?.briefing_month) return
    const controller = new AbortController()
    const query = new URLSearchParams({ regionId: selected.region_id, district: selected.district_id, month: selected.briefing_month.slice(0,7) })
    fetch(`/api/monthly-briefing?${query}`, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const data = await response.json() as MonthlyBriefingData
      if (!response.ok || !data.storage || data.district !== selected.district_id || data.month !== selected.briefing_month?.slice(0,7)) throw new Error('연결된 월간 브리핑을 조회하지 못했습니다.')
      if (!controller.signal.aborted) setBriefing(data)
    }).catch(err => { if (!controller.signal.aborted) setError(err.message) })
    return () => controller.abort()
  }, [selected])

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    if (!client || busy) return
    setBusy(true); setError('')
    try {
      const result = await client.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error
      setPassword('')
    } catch { setError('로그인에 실패했습니다. 계정과 비밀번호를 확인하세요.') }
    finally { setBusy(false) }
  }

  return <Card className="mt-5 p-6 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold">기관 공동 저장</h3><p className="mt-2 text-sm text-slate-500">정책 조건을 저장하고 같은 기관의 구성원과 함께 조회합니다.</p></div>
      {userId && <button className="min-h-11 px-3 text-sm text-slate-600" onClick={() => { void client?.auth.signOut({ scope: 'local' }).then(result => { if (result.error) setError('로그아웃에 실패했습니다.') }) }}>로그아웃</button>}</div>
    {error && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    {initializing ? <p role="status" className="mt-4 text-sm">로그인 상태 확인 중…</p> : !userId ? <form onSubmit={signIn} className="mt-5 flex flex-wrap items-end gap-3">
      <label className="grid gap-2 text-xs font-semibold">이메일<input className={fieldClass} type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)}/></label>
      <label className="grid gap-2 text-xs font-semibold">비밀번호<input className={fieldClass} type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)}/></label>
      <button className={buttonClass} disabled={!client || busy}>기관 계정 로그인</button><p className="w-full text-xs text-slate-500">기관에 등록된 계정으로 로그인하세요.</p>
    </form> : <>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="grid gap-2 text-xs font-semibold">저장 기관<select aria-label="저장 기관" className={fieldClass} value={orgId} disabled={busy} onChange={event => { setOrgId(event.target.value); setParams(previous => { const next = new URLSearchParams(previous); next.delete('scenario'); next.delete('organization'); next.delete('review'); return next }) }}><option value="" disabled>기관 선택</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.name}{item.role === 'viewer' ? ' (조회 전용)' : ''}</option>)}</select></label>
        <label className="grid gap-2 text-xs font-semibold">시행 시작월<input aria-label="시행 시작월" className={fieldClass} type="month" value={startMonth} onChange={event => setStartMonth(event.target.value)}/></label>
        <label className="grid gap-2 text-xs font-semibold">참고 브리핑 월 (선택)<input aria-label="참고 브리핑 월" className={fieldClass} type="month" value={briefingMonth} onChange={event => setBriefingMonth(event.target.value)}/></label>
        <button className={buttonClass} onClick={() => void save()} disabled={busy || !organization || organization.role === 'viewer' || !startMonth}>{busy ? '처리 중…' : '현재 조건을 기관에 저장'}</button>
      </div>
      {!organizations.length && <p className="mt-3 text-sm text-slate-500">소속 기관이 없습니다. 서비스 운영자에게 기관 등록을 요청하세요.</p>}
      <p className="mt-3 text-xs leading-5 text-slate-500">효과 예측값은 포함되지 않습니다. 참고 브리핑은 이미 저장된 같은 지역·월의 원본에 연결합니다.</p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2"><div><div className="flex items-center justify-between"><h4 className="font-semibold">이 지역의 저장 목록</h4><button className="min-h-11 px-3 text-xs text-blue-700" disabled={!orgId || busy} onClick={() => setReload(value => value + 1)}>목록 새로고침</button></div>
        <ul className="space-y-2">{items.map(item => <li key={item.id}><button className={`w-full rounded-xl border p-4 text-left ${selected?.id === item.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`} onClick={() => open(item)}><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.start_month.slice(0,7)} 시행 · {new Date(item.created_at).toLocaleString('ko-KR')}</p></button></li>)}</ul>
        {orgId && !items.length && <p className="py-4 text-sm text-slate-500">조회된 저장 기록이 없습니다.</p>}
        {nextCursor && <button className="mt-3 min-h-11 px-4 text-sm text-blue-700" disabled={busy} onClick={() => void more()}>이전 기록 더 보기</button>}
      </div><div>{selected ? <article className="rounded-xl border border-blue-100 bg-blue-50/40 p-5"><p className="text-xs font-semibold text-blue-700">저장된 시나리오 · {organization?.name}</p><h4 className="mt-2 font-bold">{selected.title}</h4><dl className="mt-4 grid grid-cols-2 gap-2 text-sm"><dt>시행 시작</dt><dd>{selected.start_month.slice(0,7)}</dd><dt>예산</dt><dd>{selected.budget_krw.toLocaleString('ko-KR')}원</dd><dt>기간</dt><dd>{selected.duration_months}개월</dd><dt>참고 브리핑</dt><dd>{selected.briefing_month?.slice(0,7) ?? '연결 없음'}</dd></dl>
        {briefing?.diagnosis && <div className="mt-4 border-t border-blue-100 pt-4"><h5 className="text-sm font-semibold">{briefing.month} 저장 브리핑</h5><p className="mt-2 text-sm leading-6">{briefing.diagnosis.summary}</p></div>}
        <button className="mt-4 min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-blue-700" onClick={() => { setStartMonth(selected.start_month.slice(0,7)); setBriefingMonth(selected.briefing_month?.slice(0,7) ?? ''); onLoad(selected); setParams(previous => { const next = new URLSearchParams(previous); next.delete('review'); return next }) }}>조건 불러오기</button>
        <p className="mt-3 text-xs leading-5 text-slate-500">다시 저장하면 새 기록이 생깁니다. 이 페이지 주소로 같은 기관 구성원이 기록을 열 수 있습니다.</p>
        {client && userId && <ScenarioReviews key={`${userId}:${orgId}:${selected.id}`} client={client} scenario={selected} canWrite={!!organization && organization.role !== 'viewer'}/> }
      </article> : <p className="p-5 text-sm text-slate-500">목록에서 저장한 조건을 선택하세요.</p>}</div></div>
    </>}
  </Card>
}
