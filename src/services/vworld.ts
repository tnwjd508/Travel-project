import type { DistrictBoundaryCollection } from '@/types/boundary'

export class VWorldApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'VWorldApiError'
  }
}

// 브라우저는 VWorld 를 직접 부르지 않는다. 인증키는 서버 프록시(/api/vworld)에만 있고,
// 프록시가 자치구 하나의 법정동 경계를 앱이 쓰는 GeoJSON 모양으로 돌려준다.
export async function getDistrictLegalDongBoundaries(
  districtSlug: string,
  signal?: AbortSignal,
): Promise<DistrictBoundaryCollection> {
  const response = await fetch(`/api/vworld?district=${encodeURIComponent(districtSlug)}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new VWorldApiError('VWorld 프록시 응답을 해석할 수 없습니다.', 'INVALID_RESPONSE')
  }

  if (!response.ok) {
    const { message, code } = (payload ?? {}) as { message?: string; code?: string }
    throw new VWorldApiError(
      message || `VWorld 요청에 실패했습니다. (${response.status})`,
      code ?? (response.status === 503 ? 'MISSING_KEY' : undefined),
    )
  }

  const collection = payload as DistrictBoundaryCollection
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new VWorldApiError('VWorld가 올바른 경계 데이터를 반환하지 않았습니다.', 'INVALID_RESPONSE')
  }
  return collection
}
