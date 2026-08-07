import { useEffect, useMemo, useRef, useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Bot, Check, CircleDollarSign, Clock3, LoaderCircle, Sparkles, Users, WandSparkles, Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'
import { policyLabels, policyOptions, type PolicyDuration, type PolicyId } from '@/data/policies'
import { useTourismStrategyStore } from '@/stores/useTourismStrategyStore'

const durations: PolicyDuration[] = ['3개월', '6개월', '1년']

export function Simulation() {
  const [loading, setLoading] = useState(false)
  const timer = useRef<number | null>(null)
  const {
    selectedPolicy,
    budget,
    duration,
    simulationResult,
    setSelectedPolicy,
    setBudget,
    setDuration,
    clearSimulationResult,
    completeSimulation,
  } = useTourismStrategyStore()

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  const run = () => {
    if (timer.current) window.clearTimeout(timer.current)
    setLoading(true)
    clearSimulationResult()
    timer.current = window.setTimeout(() => {
      completeSimulation()
      setLoading(false)
    }, 3000)
  }

  const metrics = useMemo(() => simulationResult ? [
    { label: '예상 관광객', value: `+${simulationResult.visitorChange}%`, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: '관광 소비', value: `+${simulationResult.spendingChange}%`, icon: CircleDollarSign, color: 'text-violet-600 bg-violet-50' },
    { label: '평균 체류시간', value: `+${simulationResult.stayChange}%`, icon: Clock3, color: 'text-emerald-600 bg-emerald-50' },
    { label: '핵심지 혼잡도', value: `${simulationResult.congestionChange}%`, icon: Zap, color: 'text-amber-600 bg-amber-50' },
  ] : [], [simulationResult])

  return <section>
    <div className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
      <Card className="relative overflow-hidden p-6 sm:p-8"><div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-100/50 blur-3xl"/><div className="relative"><div className="mb-6 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white"><WandSparkles size={22}/></div><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-blue-600">Policy Lab</p><h3 className="text-xl font-bold tracking-tight">정책 조건을 설계하세요</h3></div></div>
        <label className="mb-2 block text-xs font-bold text-slate-600">정책 시나리오</label><SelectField value={selectedPolicy} onValueChange={(value) => setSelectedPolicy(value as PolicyId)} options={[...policyOptions]}/>
        <div className="mt-6"><div className="mb-3 flex items-end justify-between"><label className="text-xs font-bold text-slate-600">투입 예산</label><span className="text-xl font-bold tracking-tight text-blue-600">{budget}억 원</span></div><Slider.Root value={[budget]} min={5} max={50} step={1} onValueChange={(value) => setBudget(value[0])} className="relative flex h-5 touch-none select-none items-center"><Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-slate-100"><Slider.Range className="absolute h-full bg-gradient-to-r from-blue-500 to-indigo-500"/></Slider.Track><Slider.Thumb className="block h-5 w-5 rounded-full border-4 border-white bg-blue-600 shadow-[0_2px_10px_rgba(37,99,235,.4)] outline-none ring-blue-100 focus:ring-4"/></Slider.Root><div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>5억</span><span>50억</span></div></div>
        <div className="mt-6"><label className="mb-2.5 block text-xs font-bold text-slate-600">정책 기간</label><div className="grid grid-cols-3 gap-2">{durations.map((period) => <button key={period} onClick={() => setDuration(period)} className={`rounded-xl border py-2.5 text-xs font-bold transition ${duration === period ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200'}`}>{duration === period && <Check size={12} className="mr-1 inline"/>}{period}</button>)}</div></div>
        <Button onClick={run} disabled={loading} className="mt-7 h-[52px] w-full bg-slate-950 text-white shadow-xl shadow-slate-200 hover:-translate-y-0.5 hover:bg-blue-600">{loading ? <><LoaderCircle className="animate-spin" size={18}/>AI 분석 중...</> : <><Sparkles size={18}/>AI 정책 시뮬레이션<ArrowUpRight size={17}/></>}</Button>
        {loading && <div className="mt-4"><div className="mb-2 flex justify-between text-[10px] font-semibold text-slate-400"><span>1,248만 건의 데이터를 분석하고 있어요</span><span>약 3초</span></div><div className="h-1 overflow-hidden rounded-full bg-slate-100"><motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 3, ease: 'linear' }} className="h-full bg-blue-500"/></div></div>}
      </div></Card>
      <Card className={`relative overflow-hidden p-6 transition sm:p-8 ${simulationResult ? 'border-blue-200 shadow-[0_20px_60px_rgba(37,99,235,.12)]' : ''}`}>
        <AnimatePresence mode="wait">{!simulationResult ? <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-[430px] flex-col items-center justify-center text-center"><div className="relative grid h-24 w-24 place-items-center rounded-[32px] bg-slate-50 text-slate-300"><Bot size={42}/><span className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white shadow-lg"><Sparkles size={14}/></span></div><h3 className="mt-6 text-xl font-bold text-slate-800">시뮬레이션 결과가 여기에 표시됩니다</h3><p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">정책과 예산, 기간을 선택하면<br/>AI가 가장 현실적인 성과를 예측합니다.</p></motion.div> : <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em] text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]"/>Simulation Complete</div><h3 className="mt-1.5 text-2xl font-bold tracking-tight">예상 정책 효과</h3><p className="mt-1 text-xs text-slate-400">{policyLabels[selectedPolicy]} · {budget}억 원 · {duration}</p></div><div className="rounded-xl bg-emerald-50 px-3 py-2 text-right"><p className="text-[9px] font-bold text-emerald-600">지역경제 효과</p><p className="text-sm font-extrabold text-emerald-700">{simulationResult.economicImpact}</p></div></div>
          <div className="mt-6 grid grid-cols-2 gap-3">{metrics.map((metric, index) => <motion.div key={metric.label} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * .08 }} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className={`grid h-8 w-8 place-items-center rounded-lg ${metric.color}`}><metric.icon size={15}/></div><p className="mt-4 text-[11px] font-medium text-slate-400">{metric.label}</p><p className={`mt-0.5 text-2xl font-bold tracking-tight ${metric.value.startsWith('-') ? 'text-emerald-600' : 'text-slate-950'}`}>{metric.value}</p></motion.div>)}</div>
          <div className="mt-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white"><div className="flex items-center gap-2 text-xs font-bold text-blue-300"><Bot size={15}/>ON:GIL AI 추천 이유</div><p className="mt-3 text-[13px] leading-6 text-slate-300">광주의 강점인 문화예술 자원은 야간 체류로 연결될 때 소비 효과가 가장 큽니다. 2030 세대의 선호가 높은 미디어아트와 로컬마켓을 결합하면, 도심 혼잡을 분산하면서 체류시간과 재방문 의향을 함께 높일 수 있어요.</p></div>
        </motion.div>}</AnimatePresence>
      </Card>
    </div>
  </section>
}
