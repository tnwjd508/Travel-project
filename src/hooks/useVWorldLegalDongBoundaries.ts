import { useCallback, useEffect, useState } from 'react'
import type { GwangjuDistrict } from '@/data/gwangjuDistricts'
import { normalizeBoundaryFeatures } from '@/data/gwangjuNeighborhoods'
import { getDistrictLegalDongBoundaries, VWorldApiError } from '@/services/vworld'
import type { NeighborhoodFeature } from '@/types/boundary'

export type VWorldBoundaryStatus = 'disabled' | 'loading' | 'ready' | 'error'

// 자치구별로 한 번만 받아 두고 화면을 오갈 때 재사용한다. VWorld 는 일일 호출 한도가 있다.
const cachedFeatures = new Map<string, NeighborhoodFeature[]>()
const inflightRequests = new Map<string, Promise<NeighborhoodFeature[]>>()

function loadDistrictBoundaries(slug: string) {
  const cached = cachedFeatures.get(slug)
  if (cached) return Promise.resolve(cached)

  let inflight = inflightRequests.get(slug)
  if (!inflight) {
    inflight = getDistrictLegalDongBoundaries(slug)
      .then((collection) => {
        if (collection.features.length === 0) {
          throw new VWorldApiError('조회 범위에서 법정동 경계를 찾지 못했습니다.', 'EMPTY_RESULT')
        }
        const features = normalizeBoundaryFeatures(collection.features)
        cachedFeatures.set(slug, features)
        return features
      })
      .finally(() => {
        inflightRequests.delete(slug)
      })
    inflightRequests.set(slug, inflight)
  }
  return inflight
}

function getFriendlyError(error: unknown) {
  if (error instanceof VWorldApiError) {
    if (error.code === 'MISSING_KEY') return 'VWorld 인증키가 서버에 설정되지 않았습니다.'
    if (error.code === 'INVALID_KEY' || error.code === 'INCORRECT_KEY') return 'VWorld 인증키가 올바르지 않습니다.'
    if (error.code === 'INVALID_DOMAIN' || error.code === 'INCORRECT_DOMAIN') return 'VWorld 인증키에 등록한 서비스 URL이 올바르지 않습니다.'
    if (error.code === 'OVER_REQUEST_LIMIT') return 'VWorld 일일 호출 한도를 초과했습니다.'
    if (error.code === 'UPSTREAM_TIMEOUT') return 'VWorld 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
    if (error.code === 'UPSTREAM_NETWORK') return 'VWorld 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    if (error.code === 'UPSTREAM_HTTP') return 'VWorld 서버가 요청을 거부했습니다. 인증키 설정과 서비스 상태를 확인해 주세요.'
    return '지도 경계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  }
  if (error instanceof TypeError) {
    return '네트워크 오류로 VWorld 경계를 불러오지 못했습니다.'
  }
  return 'VWorld 경계 데이터를 불러오지 못했습니다.'
}

export function useVWorldLegalDongBoundaries(district: GwangjuDistrict) {
  const [features, setFeatures] = useState<NeighborhoodFeature[]>(() => cachedFeatures.get(district.slug) ?? [])
  const [status, setStatus] = useState<VWorldBoundaryStatus>(() => (cachedFeatures.has(district.slug) ? 'ready' : 'loading'))
  const [errorMessage, setErrorMessage] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)

  const retry = useCallback(() => setRequestVersion((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    const cached = cachedFeatures.get(district.slug)
    setFeatures(cached ?? [])
    setStatus(cached ? 'ready' : 'loading')
    setErrorMessage('')

    loadDistrictBoundaries(district.slug)
      .then((loaded) => {
        if (cancelled) return
        setFeatures(loaded)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setFeatures([])
        setStatus(error instanceof VWorldApiError && error.code === 'MISSING_KEY' ? 'disabled' : 'error')
        setErrorMessage(getFriendlyError(error))
      })

    return () => {
      cancelled = true
    }
  }, [district.slug, requestVersion])

  return { features, status, errorMessage, retry }
}
