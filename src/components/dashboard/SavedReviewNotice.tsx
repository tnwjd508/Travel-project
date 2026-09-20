import { DataNotice } from './DataNotice'
import { baselineStatusLabels, type SavedReview } from '@/lib/reviewClient'

export function SavedReviewNotice({ state }: { state: { requested: boolean; status: string; data: SavedReview | null; error: string; retry: () => void } }) {
  if (!state.requested) return null
  if (!state.data) return <div className="mb-5"><DataNotice state={state}/></div>
  return <div role="status" className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-6 text-blue-900">
    저장된 검토 · {new Date(state.data.review.created_at).toLocaleString('ko-KR')} · {baselineStatusLabels[state.data.review.baseline_status]}
    <p>{state.data.scenario.title} · 저장 당시 지표와 분석 근거를 표시합니다.</p>
  </div>
}
