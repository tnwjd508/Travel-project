import { useEffect, useState, useCallback } from 'react'
import { districtRequest, type DistrictResource, type DistrictResources } from '@/services/districtApi'
import { useParams } from 'react-router-dom'

export function useDistrictResource<R extends DistrictResource>(resource: R, params: Record<string, string | number | undefined>, enabled = true) {
  const { regionId = 'gwangju' } = useParams()
  // 이름이 같은 구도 정확히 구분하도록 시도와 시군구 코드를 함께 전달합니다.
  const scopedParams: Record<string, string | number | undefined> = { regionId, ...params }
  const query = new URLSearchParams(Object.entries(scopedParams).filter((entry): entry is [string, string | number] => entry[1] !== undefined).sort().map(([key, value]) => [key, String(value)])).toString()
  const key = `${resource}?${query}`
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ key: string; status: 'loading' | 'live' | 'error'; data: DistrictResources[R] | null; error: string }>({ key, status: 'loading', data: null, error: '' })
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setState({ key, status: 'loading', data: null, error: '' })
    districtRequest(resource, query, controller.signal, attempt > 0).then(data => {
      if (!controller.signal.aborted) setState({ key, status: 'live', data, error: '' })
    }).catch(() => {
      if (!controller.signal.aborted) setState({ key, status: 'error', data: null, error: '관광 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    })
    return () => controller.abort()
  }, [resource, query, key, attempt, enabled])
  // 지역을 바꾸는 순간에도 이전 지역 데이터가 표시되지 않도록 요청 키를 비교합니다.
  return { ...(state.key === key && enabled ? state : { key, status: 'loading' as const, data: null, error: '' }), retry }
}
