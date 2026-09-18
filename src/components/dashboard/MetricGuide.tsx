import { INDEX_BASIS, INDEX_LIMIT, INDEX_SOURCE_URL, metricDefinitions, metricMonth, type MetricKey } from '@/data/tourismMetrics'

export function MetricGuide({ metrics, month }: { metrics: MetricKey[]; month: string }) {
  return <section aria-label="지수 해석 기준" className="my-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs leading-6 text-slate-600">
    <h3 className="font-bold text-slate-900">지수는 이렇게 읽습니다</h3>
    <p className="mt-1 font-semibold text-slate-700">기준월 {metricMonth(month)} · 단위: 지수 · 비교 기준: 같은 월·같은 지표의 시군구</p>
    <p className="mt-2">{INDEX_BASIS}</p>
    <dl className="mt-3 space-y-2">{metrics.map(key => <div key={key}><dt className="font-semibold text-slate-800">{metricDefinitions[key].label}</dt><dd>{metricDefinitions[key].description}</dd></div>)}</dl>
    <p className="mt-3">{INDEX_LIMIT}</p>
    <p className="mt-1">세부 표준화 산식과 기준값은 현재 연계 데이터에 포함되어 있지 않습니다. <a href={INDEX_SOURCE_URL} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline underline-offset-2">한국관광 데이터랩 지수 설명</a></p>
  </section>
}
