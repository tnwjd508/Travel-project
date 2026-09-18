import { useEffect, useState, useCallback } from 'react'
import { districtRequest, type DistrictResource, type DistrictResources } from '@/services/districtApi'

export function useDistrictResource<R extends DistrictResource>(resource: R, params: Record<string, string | number | undefined>, enabled = true) {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string | number] => entry[1] !== undefined).sort().map(([key, value]) => [key, String(value)])).toString()
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
    }).catch(error => {
      if (!controller.signal.aborted) setState({ key, status: 'error', data: null, error: error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.' })
    })
    return () => controller.abort()
  }, [resource, query, key, attempt, enabled])
  // Prevent even one render of the previous district's data after URL changes.
  return { ...(state.key === key && enabled ? state : { key, status: 'loading' as const, data: null, error: '' }), retry }
}
