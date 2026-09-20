import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireTourismDistrict } from '@/data/tourismRegions'
import { accountClient, scenarioRequest } from '@/lib/scenarioClient'
import { evidencePageSchema, reviewDetailSchema, type PolicyEvidence, type SavedReview } from '@/lib/reviewClient'
import { useDistrictResource } from './useDistrictResource'

type State<T> = { key: string; status: 'loading' | 'live' | 'error'; data: T | null; error: string }
const pending = <T,>(key: string): State<T> => ({ key, status: 'loading', data: null, error: '' })

export function useSavedReview(districtId: string) {
  const [params] = useSearchParams()
  const org = params.get('organization') ?? '', scenario = params.get('scenario') ?? '', review = params.get('review') ?? ''
  const requested = params.has('review')
  const district = requireTourismDistrict(districtId)
  const [auth, setAuth] = useState<{ client: SupabaseClient | null; user: string; ready: boolean; error: string }>({ client: null, user: '', ready: false, error: '' })
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(n => n + 1), [])
  const key = JSON.stringify([org, scenario, review, district.id, auth.user, requested])
  const [state, setState] = useState<State<SavedReview>>(() => pending(key))
  useEffect(() => {
    if (!requested) { setAuth({ client: null, user: '', ready: false, error: '' }); return }
    let active = true
    let unsubscribe: (() => void) | undefined
    accountClient().then(async client => {
      if (!active) return
      const subscription = client.auth.onAuthStateChange((_event, session) => {
        if (active) setAuth({ client, user: session?.user.id ?? '', ready: true, error: '' })
      })
      unsubscribe = () => subscription.data.subscription.unsubscribe()
      const { data, error } = await client.auth.getSession()
      if (error) throw error
      if (active) setAuth({ client, user: data.session?.user.id ?? '', ready: true, error: '' })
    }).catch(() => { if (active) setAuth({ client: null, user: '', ready: true, error: 'unavailable' }) })
    return () => { active = false; unsubscribe?.() }
  }, [requested, attempt])
  useEffect(() => {
    setState(pending(key))
    if (!requested || !auth.ready) return
    if (!org || !scenario || !review || !auth.client || !auth.user) {
      setState({ key, status: 'error', data: null, error: auth.error ? '공동 저장 서비스에 연결하지 못했습니다.' : !auth.user ? '정책 시뮬레이션 화면에서 기관 계정으로 로그인하세요.' : '기관·시나리오·검토가 포함된 저장 주소를 열어 주세요.' })
      return
    }
    const controller = new AbortController()
    scenarioRequest(auth.client, `/api/scenario-reviews/${encodeURIComponent(review)}?organizationId=${encodeURIComponent(org)}`, reviewDetailSchema, { signal: controller.signal }).then(data => {
      if (data.review.id !== review || data.review.organization_id !== org || data.review.scenario_id !== scenario || data.scenario.id !== scenario || data.scenario.organization_id !== org || data.scenario.district_id !== district.id || data.evidence.districtId !== district.id) throw new Error('현재 지역·시나리오와 저장된 검토가 일치하지 않습니다.')
      if (!controller.signal.aborted) setState({ key, status: 'live', data, error: '' })
    }).catch(error => { if (!controller.signal.aborted) setState({ key, status: 'error', data: null, error: error instanceof Error ? error.message : '검토를 불러오지 못했습니다.' }) })
    return () => controller.abort()
  }, [requested, org, scenario, review, district.id, auth.client, auth.user, auth.ready, auth.error, key, attempt])
  return { ...(state.key === key ? state : pending<SavedReview>(key)), requested, retry }
}

function useEvidence(districtId: string, release: string | null, enabled: boolean) {
  const district = requireTourismDistrict(districtId)
  const key = JSON.stringify([district.id, release, enabled])
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(n => n + 1), [])
  const [state, setState] = useState<State<PolicyEvidence[]>>(() => pending(key))
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setState(pending(key))
    const query = new URLSearchParams({ district: district.id, regionId: district.regionId })
    if (release) query.set('releaseId', release)
    fetch(`/api/policy-evidence?${query}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const payload = await response.json()
      if (!response.ok) throw new Error(typeof payload.message === 'string' ? payload.message : '분석 근거를 불러오지 못했습니다.')
      const parsed = evidencePageSchema.safeParse(payload)
      if (!parsed.success) throw new Error('분석 근거의 데이터 형식을 확인하지 못했습니다.')
      const data = parsed.data
      if (data.districtId !== district.id || data.regionId !== district.regionId || (release && data.releaseId !== release) || new Set(data.items.map(item => item.policy)).size !== 5 || data.items.some(item => item.districtId !== district.id || item.regionId !== district.regionId || (item.releaseId && item.releaseId !== data.releaseId))) throw new Error('분석 근거의 지역 또는 버전이 일치하지 않습니다.')
      if (!controller.signal.aborted) setState({ key, status: 'live', data: data.items, error: '' })
    }).catch(error => { if (!controller.signal.aborted) setState({ key, status: 'error', data: null, error: error instanceof Error ? error.message : '분석 근거를 불러오지 못했습니다.' }) })
    return () => controller.abort()
  }, [key, district.id, district.regionId, release, enabled, attempt])
  return { ...(enabled && state.key === key ? state : pending<PolicyEvidence[]>(key)), retry }
}

export function useReviewData(districtId: string) {
  const saved = useSavedReview(districtId)
  const liveSummary = useDistrictResource('summary', { district: districtId }, !saved.requested)
  const liveDiagnosis = useDistrictResource('diagnosis', { district: districtId }, !saved.requested)
  const evidenceState = useEvidence(districtId, null, !saved.requested)
  const frozen = saved.data?.review.baseline_snapshot
  function baseline<T>(data: T | null | undefined) {
    return { status: saved.status === 'live' && !data ? 'error' as const : saved.status, data: data ?? null,
      error: saved.status === 'live' ? '이 검토에는 해당 기준선 자료가 저장되지 않았습니다.' : saved.error, retry: saved.retry }
  }
  // NULL in an immutable review must never fall through to today's live response.
  const summaryState = saved.requested ? baseline(frozen?.summary) : liveSummary
  const diagnosisState = saved.requested ? baseline(frozen?.diagnosis) : liveDiagnosis
  // Other policies were not frozen by this review. Re-evaluating them would mix selection rules.
  const evidence = (policy: string) => saved.requested
    ? saved.data?.scenario.policy_code === policy ? saved.data.evidence : null
    : evidenceState.data?.find(item => item.policy === policy) ?? null
  return { saved, summaryState, diagnosisState, evidenceState: saved.requested ? { status: saved.status, data: null, error: saved.error, retry: saved.retry } : evidenceState, evidence }
}
