// KorService2/lclsSystmCode2, lclsSystmListYn=N 공식 대분류 (2026-09-18 확인).
// contentTypeId(12, 14, …)와 다른 코드 체계이며 API의 category는 lclsSystm1이다.
const categoryNames: Record<string, string> = {
  AC: '숙박', C01: '추천코스', EV: '축제/공연/행사', EX: '체험관광',
  FD: '음식', HS: '역사관광', LS: '레저스포츠', NA: '자연관광', SH: '쇼핑', VE: '문화관광',
}

export function contentCategoryName(code: string) {
  return Object.prototype.hasOwnProperty.call(categoryNames, code) ? categoryNames[code] : '분류 정보 없음'
}
