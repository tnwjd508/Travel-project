import { regionCatalogue } from '../src/data/tourismRegions.js'

// 개발 서버와 배포 함수가 같은 공개 지역 목록을 제공합니다.
export function handleRegions(method?: string) {
  return {
    status: method === 'GET' ? 200 : 405,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache', ...(method === 'GET' ? {} : { Allow: 'GET' }) },
    body: method === 'GET' ? regionCatalogue : { message: 'GET 요청만 지원합니다.' },
  }
}
