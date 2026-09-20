import { useCallback, useEffect, useState } from 'react'
import { requireTourismDistrict } from '@/data/tourismRegions'
import { evidencePageSchema, type PolicyEvidence } from '@/lib/evidenceClient'
import { useDistrictResource } from './useDistrictResource'

type EvidenceState = { key: string; status: 'loading' | 'live' | 'error'; data: PolicyEvidence[] | null; error: string }

export function useMunicipalityData(districtId: string) {
  const district = requireTourismDistrict(districtId)
  const summaryState = useDistrictResource('summary', { district: district.id })
  const diagnosisState = useDistrictResource('diagnosis', { district: district.id })
  const key = `${district.regionId}:${district.id}`
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  const [state, setState] = useState<EvidenceState>({ key, status: 'loading', data: null, error: '' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ key, status: 'loading', data: null, error: '' })
    const query = new URLSearchParams({ district: district.id, regionId: district.regionId })
    fetch(`/api/policy-evidence?${query}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const payload: unknown = await response.json()
      if (!response.ok) throw new Error(messageFrom(payload) ?? '분석 근거를 불러오지 못했습니다.')
      const parsed = evidencePageSchema.safeParse(payload)
      if (!parsed.success) throw new Error('분석 근거의 데이터 형식을 확인하지 못했습니다.')
      const data = parsed.data
      if (data.districtId !== district.id || data.regionId !== district.regionId
        || new Set(data.items.map(item => item.policy)).size !== 5
        || data.items.some(item => item.districtId !== district.id || item.regionId !== district.regionId
          || (item.releaseId && item.releaseId !== data.releaseId))) {
        throw new Error('분석 근거의 지자체 또는 버전이 일치하지 않습니다.')
      }
      if (!controller.signal.aborted) setState({ key, status: 'live', data: data.items, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ key, status: 'error', data: null, error: error instanceof Error ? error.message : '분석 근거를 불러오지 못했습니다.' })
    })
    return () => controller.abort()
  }, [key, district.id, district.regionId, attempt])

  const evidenceState = state.key === key ? { ...state, retry } : { key, status: 'loading' as const, data: null, error: '', retry }
  const evidence = (policyCode: string) => evidenceState.data?.find(item => item.policy === policyCode) ?? null
  return { summaryState, diagnosisState, evidenceState, evidence }
}

function messageFrom(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('message' in payload)) return null
  return typeof payload.message === 'string' ? payload.message : null
}
