import type { DistrictMeta } from '@/types/district'

export function formatValue(value: number | null | undefined, decimals = 0) {
  return value == null ? '자료 없음' : value.toLocaleString('ko-KR', { maximumFractionDigits: decimals })
}
export function SourceNote({ data }: { data: DistrictMeta & { temporalBasis?: string } }) {
  const dateLabel = data.temporalBasis === 'fetchedAt' ? '조회 시점의 콘텐츠' : data.temporalBasis === 'event_dates' ? '행사일 기준' : `기준월 ${data.baseYm.slice(0, 4)}.${data.baseYm.slice(4)}`
  const collected = new Date(data.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' })
  return <p className="mt-5 text-[12px] leading-5 text-slate-500">
    <span className="font-semibold text-emerald-700">실데이터</span> · {dateLabel} · {data.source} · 수집 {collected} (한국 시간)
  </p>
}
export function DataNotice({ state }: { state: { status: string; error: string; retry: () => void } }) {
  if (state.status === 'live') return null
  if (state.status === 'loading') return <p role="status" className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">관광 데이터를 불러오는 중입니다.</p>
  return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><p>{state.error}</p><button type="button" onClick={state.retry} className="mt-2 min-h-10 rounded-lg border border-amber-300 px-3 font-semibold focus-visible:outline-blue-600">다시 시도</button></div>
}
