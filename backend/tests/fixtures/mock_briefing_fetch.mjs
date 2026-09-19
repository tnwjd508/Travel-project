// 테스트 전용 DB 응답입니다. 조회 도중 관광 API나 Gemini 호출이 생기면 실패합니다.
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input))
  if (url.hostname !== 'database.example' || url.pathname !== '/rest/v1/rpc/briefing_get') throw new Error('예상하지 않은 외부 호출')
  if (init.headers.apikey !== 'sb_secret_fixture') throw new Error('서버 키 전달 실패')
  const query = JSON.parse(init.body)
  return Response.json({ state: query.p_district_id === '11110' ? 'generating' : 'missing' })
}
