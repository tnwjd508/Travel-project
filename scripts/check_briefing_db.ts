import { loadEnv } from 'vite'
import { createSupabaseRepository, BriefingDatabaseError } from '../server/briefing/repository.js'
import { koreaDate, previousMonth } from '../server/briefing/data.js'

// 읽기 함수만 실행합니다. 관광 API·Gemini 호출이나 새 브리핑 생성은 하지 않습니다.
const environment = { ...loadEnv('development', process.cwd(), ['SUPABASE_']), ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('SUPABASE_'))) }
try {
  const result = await createSupabaseRepository(environment).get({ regionId: 'seoul', districtId: '11110', month: previousMonth(koreaDate()) })
  console.log(`월간 브리핑 DB 연결 및 조회 함수 확인 완료: ${result.state}`)
} catch (error) {
  console.error(error instanceof BriefingDatabaseError ? error.message : 'DB 연결을 확인하지 못했습니다.')
  console.error('서버 전용 환경변수와 001, 002 마이그레이션 적용 여부를 확인해 주세요. 키 값은 출력하지 않습니다.')
  process.exitCode = 1
}
