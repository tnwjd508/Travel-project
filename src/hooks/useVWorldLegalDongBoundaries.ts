import { useCallback, useEffect, useState } from 'react'
import {
  getVWorldLegalDongBoundaries,
  isVWorldConfigured,
  VWorldApiError,
  type VWorldBoundaryFeature,
} from '@/services/vworld'

// 광주 기존 5개 자치구를 포함하는 범위입니다. EPSG:4326 WFS 1.1 축 순서에 맞췄습니다.
const GWANGJU_BBOX: [number, number, number, number] = [34.95, 126.55, 35.32, 127.12]

export type VWorldBoundaryStatus = 'disabled' | 'loading' | 'ready' | 'error'

function getFriendlyError(error: unknown) {
  if (error instanceof VWorldApiError) {
    if (error.code === 'INCORRECT_KEY') return '인증키 또는 등록 URL이 현재 주소와 일치하지 않습니다.'
    if (error.code === 'OVER_REQUEST_LIMIT') return 'VWorld 일일 호출 한도를 초과했습니다.'
    return error.message
  }
  if (error instanceof DOMException && error.name === 'AbortError') return ''
  if (error instanceof TypeError) {
    return '브라우저 요청이 차단됐습니다. VWorld 등록 URL과 현재 주소를 확인하세요.'
  }
  return 'VWorld 경계 데이터를 불러오지 못했습니다.'
}

export function useVWorldLegalDongBoundaries() {
  const [features, setFeatures] = useState<VWorldBoundaryFeature[]>([])
  const [status, setStatus] = useState<VWorldBoundaryStatus>(
    isVWorldConfigured() ? 'loading' : 'disabled',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)

  const retry = useCallback(() => setRequestVersion((value) => value + 1), [])

  useEffect(() => {
    if (!isVWorldConfigured()) {
      setStatus('disabled')
      setErrorMessage('VWorld 환경변수가 없어 정적 경계를 사용합니다.')
      return
    }

    const controller = new AbortController()
    setStatus('loading')
    setErrorMessage('')

    getVWorldLegalDongBoundaries({
      bbox: GWANGJU_BBOX,
      maxFeatures: 500,
      signal: controller.signal,
    })
      .then((collection) => {
        if (collection.features.length === 0) {
          throw new VWorldApiError('조회 범위에서 읍면동 경계를 찾지 못했습니다.', 'EMPTY_RESULT')
        }
        setFeatures(collection.features)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFeatures([])
        setStatus('error')
        setErrorMessage(getFriendlyError(error))
      })

    return () => controller.abort()
  }, [requestVersion])

  return { features, status, errorMessage, retry }
}
