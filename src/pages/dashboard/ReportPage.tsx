import { useState } from 'react'
import { CheckCircle2, FileText, Printer, Sparkles } from 'lucide-react'
import { DashboardPageFrame } from '@/components/dashboard/DashboardPageFrame'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { policyLabels } from '@/data/policies'
import { useTourismStrategyStore } from '@/stores/useTourismStrategyStore'

const issues = ['2030 관광객 감소', '야간 관광 콘텐츠 부족', '핵심 관광지 방문 집중', '숨은 관광지 저인지']
const priorities = ['야간 문화예술 콘텐츠 확장', '로컬마켓과 도심 관광 동선 연결', '2030 맞춤형 디지털 캠페인']

export function ReportPage() {
  const { recommendedStrategy, budget, duration, simulationResult } = useTourismStrategyStore()
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const analysisDate = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date())

  return <DashboardPageFrame eyebrow="AI Strategy Report" title="분석 결과를 하나의 보고서로 정리합니다" description="지역 현황과 핵심 문제, 추천 정책 및 예상 효과를 정책 보고서 형태로 확인하세요." icon={FileText}>
    <div className="mb-5 flex flex-wrap justify-end gap-2 print:hidden">
      <Button onClick={() => setGeneratedAt(new Date().toISOString())} className="border border-blue-200 bg-white text-blue-700 hover:bg-blue-50"><Sparkles size={15}/>보고서 생성</Button>
      <Button onClick={() => window.print()} disabled={!generatedAt} className="bg-slate-950 text-white hover:bg-blue-600"><Printer size={15}/>인쇄·PDF 저장</Button>
    </div>

    <Card className="print-report overflow-hidden bg-white p-6 sm:p-9 lg:p-12">
      <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2 text-xs font-extrabold tracking-[-.03em] text-slate-950">ON<span className="text-blue-600">:</span>GIL <span className="font-medium text-slate-300">/</span> AI REPORT</div><h2 className="mt-5 text-3xl font-extrabold tracking-[-.05em] text-slate-950">광주광역시 관광전략 분석 보고서</h2><p className="mt-2 text-sm text-slate-400">AI 기반 지역 관광 활성화 정책 의사결정 지원</p></div><dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-xs"><dt className="text-slate-400">분석 지역</dt><dd className="font-bold text-slate-700">광주광역시</dd><dt className="text-slate-400">분석 날짜</dt><dd className="font-bold text-slate-700">{analysisDate}</dd><dt className="text-slate-400">보고서 상태</dt><dd className={`font-bold ${generatedAt ? 'text-emerald-600' : 'text-amber-600'}`}>{generatedAt ? '생성 완료' : '미리보기'}</dd></dl></header>

      <section className="grid gap-4 border-b border-slate-100 py-7 sm:grid-cols-4">{[
        ['월 관광객', '482,000명', '+8.7%'], ['평균 체류시간', '31.8시간', '+5.2%'], ['1인 관광 소비', '148,000원', '+11.4%'], ['관광 성장지수', '12.4점', '+3.1%'],
      ].map(([label, value, change]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-bold text-slate-400">{label}</p><p className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-[10px] font-bold text-emerald-600">{change}</p></div>)}</section>

      <div className="grid gap-8 py-8 lg:grid-cols-2">
        <section><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-600">01 · Diagnosis</p><h3 className="mt-2 text-lg font-bold text-slate-900">핵심 문제</h3><div className="mt-4 space-y-2">{issues.map((issue, index) => <div key={issue} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"><span className="grid h-6 w-6 place-items-center rounded-lg bg-red-50 text-[9px] font-bold text-red-500">{index + 1}</span><span className="text-xs font-semibold text-slate-600">{issue}</span></div>)}</div></section>
        <section><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-600">02 · Recommendation</p><h3 className="mt-2 text-lg font-bold text-slate-900">추천 정책</h3><div className="mt-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white"><div className="flex items-center gap-2 text-xs font-bold text-blue-300"><Sparkles size={14}/>최우선 추천 전략</div><p className="mt-3 text-xl font-extrabold">{policyLabels[recommendedStrategy]}</p><p className="mt-2 text-xs leading-6 text-slate-400">예산 {budget}억 원 · 시행 기간 {duration}<br/>문화예술 자원을 야간 체류와 지역 소비로 연결하는 전략입니다.</p></div></section>
      </div>

      <section className="border-t border-slate-100 py-8"><div className="flex items-end justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-600">03 · Expected Impact</p><h3 className="mt-2 text-lg font-bold text-slate-900">예상 정책 효과</h3></div>{!simulationResult && <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-600">시뮬레이션 실행 전 기본 예측</span>}</div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
        ['관광객', `+${simulationResult?.visitorChange ?? 15}%`], ['관광 소비', `+${simulationResult?.spendingChange ?? 18}%`], ['체류시간', `+${simulationResult?.stayChange ?? 11}%`], ['혼잡도', `${simulationResult?.congestionChange ?? -8}%`],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-center"><p className="text-[10px] font-bold text-slate-400">{label}</p><p className="mt-1 text-2xl font-extrabold text-blue-700">{value}</p></div>)}</div></section>

      <section className="grid gap-6 border-t border-slate-100 py-8 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-600">04 · Priority</p><h3 className="mt-2 text-lg font-bold text-slate-900">실행 우선순위</h3><ol className="mt-4 space-y-3">{priorities.map((priority, index) => <li key={priority} className="flex items-center gap-3 text-xs font-semibold text-slate-600"><CheckCircle2 size={15} className="text-emerald-500"/><span className="text-slate-300">0{index + 1}</span>{priority}</li>)}</ol></div><div className="rounded-2xl border border-slate-100 bg-slate-50 p-5"><div className="flex items-center gap-2 text-xs font-bold text-blue-600"><Sparkles size={14}/>ON:GIL AI 종합 의견</div><p className="mt-3 text-[13px] leading-7 text-slate-600">광주는 문화예술 자원의 경쟁력이 높지만 야간 체류와 주변 상권 소비로 연결되는 동선이 부족합니다. 국립아시아문화전당을 중심으로 미디어아트, 로컬마켓, 야간 이동 서비스를 결합하면 방문 집중을 분산하면서 체류시간과 관광 소비를 함께 높일 수 있습니다.</p></div></section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-[9px] text-slate-400"><span>한국관광공사 Tourism Data Lab 연계 · ON:GIL AI 분석</span><span>{generatedAt ? `생성 ID · ${new Date(generatedAt).getTime()}` : '보고서 생성 버튼을 눌러 결과를 확정하세요.'}</span></footer>
    </Card>
  </DashboardPageFrame>
}
