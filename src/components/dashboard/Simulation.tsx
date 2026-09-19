import * as Slider from '@radix-ui/react-slider'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CircleDollarSign, ClipboardList, Clock3, FlaskConical, Info, Users, Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'
import { DataNotice, SourceNote, formatValue } from '@/components/dashboard/DataNotice'
import { policyLabels, policyOptions, policyTargets, type PolicyDuration, type PolicyId } from '@/data/policies'
import { diagnosisCriteria, issueStatusLabels } from '@/data/tourismMetrics'
import { evidenceStatusClass, evidenceStatusLabels, festivalEvidenceMeta, formatPct, formatRange, policyEvidence } from '@/data/festivalEffect'
import { useTourismStrategyStore } from '@/stores/useTourismStrategyStore'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { useDistrictResource } from '@/hooks/useDistrictResource'
import { ScenarioLibrary } from '@/components/dashboard/ScenarioLibrary'

const durations: PolicyDuration[] = ['3개월', '6개월', '1년']

const outcomeMetrics = [
  { label: '방문객 변화', icon: Users },
  { label: '관광 소비 변화', icon: CircleDollarSign },
  { label: '체류 변화', icon: Clock3 },
  { label: '핵심지 집중도 변화', icon: Zap },
]

export function Simulation() {
  const district = useActiveDistrict()
  const diagnosisState = useDistrictResource('diagnosis', { district: district.slug })
  const summaryState = useDistrictResource('summary', { district: district.slug })
  const {
    selectedPolicy,
    budget,
    duration,
    simulationResult,
    setSelectedPolicy,
    setBudget,
    setDuration,
    completeSimulation,
    clearSimulationResult,
  } = useTourismStrategyStore()

  // 다른 자치구에서 만든 시나리오는 이 화면에 표시하지 않는다.
  const scenario = simulationResult?.district === district.slug ? simulationResult : null
  const inputsChanged = scenario != null && (scenario.policy !== selectedPolicy || scenario.budget !== budget || scenario.duration !== duration)
  const target = scenario ? policyTargets[scenario.policy] : null
  const targetIssues = target && diagnosisState.data
    ? target.issueIds.map(id => diagnosisState.data!.issues.find(issue => issue.id === id)).filter(issue => issue != null)
    : []
  const evidence = scenario ? policyEvidence(scenario.policy, district.slug) : null
  // 기준월 외지인 일평균 × 효과 구간 = 축제 하루에 늘어나는 외지인 수의 어림값
  const month = summaryState.data?.visitors
  const dailyOutside = month?.complete && month.outside != null && month.observedDays > 0 ? month.outside / month.observedDays : null
  const extraVisitors = evidence?.status === 'evidence_based' && evidence.stat && dailyOutside != null
    ? evidence.stat.ci95Pct.map(pct => Math.round((dailyOutside * pct) / 100 / 100) * 100)
    : null

  return <section>
    <div className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
      <Card className="relative overflow-hidden p-6 sm:p-8"><div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-100/50 blur-3xl"/><div className="relative"><div className="mb-6 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white"><FlaskConical size={22}/></div><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-blue-600">Policy Lab</p><h3 className="text-xl font-bold tracking-tight">정책 조건을 설계하세요</h3></div></div>
        <label className="mb-2 block text-xs font-bold text-slate-600">정책 시나리오</label><SelectField value={selectedPolicy} onValueChange={(value) => setSelectedPolicy(value as PolicyId)} options={[...policyOptions]}/>
        <div className="mt-6"><div className="mb-3 flex items-end justify-between"><label className="text-xs font-bold text-slate-600">투입 예산</label><span className="text-xl font-bold tracking-tight text-blue-600">{budget}억 원</span></div><Slider.Root value={[budget]} min={5} max={50} step={1} onValueChange={(value) => setBudget(value[0])} className="relative flex h-5 touch-none select-none items-center"><Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-slate-100"><Slider.Range className="absolute h-full bg-gradient-to-r from-blue-500 to-indigo-500"/></Slider.Track><Slider.Thumb aria-label="투입 예산" className="block h-5 w-5 rounded-full border-4 border-white bg-blue-600 shadow-[0_2px_10px_rgba(37,99,235,.4)] outline-none ring-blue-100 focus:ring-4"/></Slider.Root><div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>5억</span><span>50억</span></div></div>
        <div className="mt-6"><label className="mb-2.5 block text-xs font-bold text-slate-600">정책 기간</label><div className="grid grid-cols-3 gap-2">{durations.map((period) => <button key={period} onClick={() => setDuration(period)} className={`rounded-xl border py-2.5 text-xs font-bold transition ${duration === period ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200'}`}>{duration === period && <Check size={12} className="mr-1 inline"/>}{period}</button>)}</div></div>
        <Button onClick={() => completeSimulation(district.slug)} className="mt-7 h-[52px] w-full bg-slate-950 text-white shadow-xl shadow-slate-200 hover:-translate-y-0.5 hover:bg-blue-600"><ClipboardList size={18}/>{scenario ? '이 조건으로 다시 검토' : '정책 시나리오 검토'}</Button>
        <p className="mt-3 text-[11px] leading-5 text-slate-500">문화축제는 과거 전국 축제 사례로 방문 변화를 추정해 보여줍니다. 예산·기간에 따른 효과 차이는 근거 데이터가 없어 반영하지 않습니다.</p>
      </div></Card>
      <Card className={`relative overflow-hidden p-6 transition sm:p-8 ${scenario ? 'border-blue-200' : ''}`}>
        <AnimatePresence mode="wait">{!scenario || !target ? <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-[430px] flex-col items-center justify-center text-center"><div className="grid h-24 w-24 place-items-center rounded-[32px] bg-slate-50 text-slate-300"><ClipboardList size={42}/></div><h3 className="mt-6 text-xl font-bold text-slate-800">시나리오 검토 결과가 여기에 표시됩니다</h3><p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">정책과 예산, 기간을 선택하면<br/>정책이 겨냥하는 지표의 현재 상태를 보여드립니다.</p></motion.div> : <motion.div key={scenario.createdAt} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-blue-600">Scenario Review</p><h3 className="mt-1.5 text-2xl font-bold tracking-tight">{policyLabels[scenario.policy]}</h3><p className="mt-1 text-xs text-slate-500">{district.nameKo} · {scenario.budget}억 원 · {scenario.duration}</p></div>{evidence && <span className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${evidenceStatusClass[evidence.status]}`}>{evidenceStatusLabels[evidence.status]}</span>}</div>
          {inputsChanged && <p role="status" className="mt-4 rounded-xl bg-blue-50 px-4 py-2.5 text-[11px] text-blue-800">조건이 바뀌었습니다. 새 조건을 반영하려면 다시 검토하세요.</p>}
          <p className="mt-5 text-[13px] leading-6 text-slate-600">{target.rationale}</p>

          <h4 className="mt-6 text-xs font-bold text-slate-600">목표 지표의 현재 상태 <span className="font-medium text-slate-400">(실데이터 기준선)</span></h4>
          <div className="mt-2"><DataNotice state={diagnosisState}/></div>
          <div className="mt-2 space-y-2">{targetIssues.map(issue => <div key={issue.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-slate-800">{issue.label}</p><span className={`shrink-0 text-[11px] font-semibold ${issue.status === 'attention' ? 'text-amber-700' : 'text-slate-500'}`}>{issueStatusLabels[issue.status]}</span></div><p className="mt-1 text-lg font-bold tracking-tight text-slate-950">{formatValue(issue.value, 2)}<span className="ml-1 text-[11px] font-medium text-slate-400">{issue.unit === 'percent' ? '%' : '지수'}</span></p><p className="mt-1 text-[11px] leading-5 text-slate-500">{diagnosisCriteria[issue.id]}</p></div>)}</div>
          {diagnosisState.data && <SourceNote data={diagnosisState.data}/>}

          <h4 className="mt-6 text-xs font-bold text-slate-600">과거 사례의 방문 변화</h4>
          <div className="mt-2 grid grid-cols-2 gap-2">{outcomeMetrics.map((metric, index) => {
            const stat = index === 0 && evidence?.stat ? evidence.stat : null
            return <div key={metric.label} className={`rounded-xl p-3 ${stat && evidence?.status === 'evidence_based' ? 'border border-emerald-200 bg-emerald-50/60' : 'border border-dashed border-slate-200'}`}><div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><metric.icon size={13}/>{metric.label}</div>
              {stat && evidence?.status === 'evidence_based' ? <><p className="mt-1 text-lg font-bold tracking-tight text-slate-950">{formatPct(stat.meanPct)}</p><p className="text-[10px] leading-4 text-slate-500">외지인 · 축제 기간 · 95% {formatRange(stat)}</p></>
                : stat ? <><p className="mt-1 text-xs font-semibold text-amber-700">근거 부족</p><p className="text-[10px] leading-4 text-slate-500">95% {formatRange(stat)} (0 포함)</p></>
                : <p className="mt-1 text-xs font-semibold text-slate-400">모델 연결 후 제공</p>}</div>
          })}</div>
          {evidence?.stat && <div className="mt-3 rounded-xl border border-slate-100 p-4 text-[11px] leading-5 text-slate-600">
            <p className="font-bold text-slate-800">근거: {evidence.basis}</p>
            <p className="mt-1">방문자 자료 {festivalEvidenceMeta.visitorsFrom.slice(0, 4)}.{festivalEvidenceMeta.visitorsFrom.slice(4, 6)}~{festivalEvidenceMeta.visitorsTo.slice(0, 4)}.{festivalEvidenceMeta.visitorsTo.slice(4, 6)} · 분석 축제 개최 {festivalEvidenceMeta.festivalStart.first.slice(0, 4)}~{festivalEvidenceMeta.festivalStart.last.slice(0, 4)}년(절반이 {festivalEvidenceMeta.festivalStart.median.slice(0, 4)}.{festivalEvidenceMeta.festivalStart.median.slice(4, 6)} 이후)</p>
            {extraVisitors && <p className="mt-1">참고 환산: {district.nameKo} 기준월 외지인 일평균 {formatValue(dailyOutside, 0)}명에 과거 통계 구간을 단순 적용한 값은 약 {formatValue(extraVisitors[0], 0)}~{formatValue(extraVisitors[1], 0)}명입니다.</p>}
            <p className="mt-1">{festivalEvidenceMeta.method}</p>
            <p className="mt-1">위약 검정(축제 없는 날짜 {formatValue(festivalEvidenceMeta.placebo.n, 0)}건): {formatPct(festivalEvidenceMeta.placebo.meanPct)} ({formatRange(festivalEvidenceMeta.placebo)})</p>
            <p className="mt-1 text-slate-500">출처: {festivalEvidenceMeta.sources}</p>
          </div>}
          <p className="mt-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500"><Info size={14} className="mt-0.5 shrink-0"/>{evidence?.status === 'evidence_based'
            ? '과거 사례의 평균이며 이 정책의 효과를 보장하지 않습니다. 소비·체류·집중도 변화와 예산 규모별 효과는 근거 데이터가 없어 표시하지 않습니다.'
            : '정책과 목표 지표의 연결은 기획 단계의 가정입니다. 검증된 근거가 없어 효과 크기(%)나 경제 효과는 표시하지 않습니다.'}</p>
        </motion.div>}</AnimatePresence>
      </Card>
    </div>
    <ScenarioLibrary district={district.slug} policy={selectedPolicy} budget={budget} duration={duration}
      onClear={clearSimulationResult}
      onLoad={saved => {
        setSelectedPolicy(saved.policy_code)
        setBudget(saved.budget_krw / 100000000)
        setDuration(saved.duration_months === 12 ? '1년' : saved.duration_months === 6 ? '6개월' : '3개월')
        completeSimulation(district.slug)
      }}/>
  </section>
}
