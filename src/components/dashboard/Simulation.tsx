import { useMemo, useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Bot, Check, CircleDollarSign, Clock3, LoaderCircle, Sparkles, Users, WandSparkles, Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'

const policies = [
  {value:'night',label:'야간관광 확대'},{value:'festival',label:'문화축제 개최'},{value:'shuttle',label:'관광 셔틀 운영'},{value:'market',label:'로컬마켓 연계'},{value:'art',label:'문화예술 프로그램'}
]
const policyCopy: Record<string,string> = {night:'야간관광 확대',festival:'문화축제 개최',shuttle:'관광 셔틀 운영',market:'로컬마켓 연계',art:'문화예술 프로그램'}

export function Simulation() {
  const [policy,setPolicy]=useState('night'); const [budget,setBudget]=useState([15]); const [period,setPeriod]=useState('6개월'); const [loading,setLoading]=useState(false); const [done,setDone]=useState(false)
  const run=()=>{setLoading(true);setDone(false);window.setTimeout(()=>{setLoading(false);setDone(true)},3000)}
  const metrics=useMemo(()=>[
    {label:'예상 관광객',value:'+15%',icon:Users,color:'text-blue-600 bg-blue-50'}, {label:'관광 소비',value:'+18%',icon:CircleDollarSign,color:'text-violet-600 bg-violet-50'},
    {label:'평균 체류시간',value:'+11%',icon:Clock3,color:'text-emerald-600 bg-emerald-50'}, {label:'핵심지 혼잡도',value:'-8%',icon:Zap,color:'text-amber-600 bg-amber-50'},
  ],[])
  return <section id="simulation" className="scroll-mt-28">
    <div className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
      <Card className="relative overflow-hidden p-6 sm:p-8"><div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-100/50 blur-3xl"/><div className="relative"><div className="mb-6 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white"><WandSparkles size={22}/></div><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-blue-600">Policy Lab</p><h3 className="text-xl font-bold tracking-tight">정책 조건을 설계하세요</h3></div></div>
        <label className="mb-2 block text-xs font-bold text-slate-600">정책 시나리오</label><SelectField value={policy} onValueChange={setPolicy} options={policies}/>
        <div className="mt-6"><div className="mb-3 flex items-end justify-between"><label className="text-xs font-bold text-slate-600">투입 예산</label><span className="text-xl font-bold tracking-tight text-blue-600">{budget[0]}억 원</span></div><Slider.Root value={budget} min={5} max={50} step={1} onValueChange={setBudget} className="relative flex h-5 touch-none select-none items-center"><Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-slate-100"><Slider.Range className="absolute h-full bg-gradient-to-r from-blue-500 to-indigo-500"/></Slider.Track><Slider.Thumb className="block h-5 w-5 rounded-full border-4 border-white bg-blue-600 shadow-[0_2px_10px_rgba(37,99,235,.4)] outline-none ring-blue-100 focus:ring-4"/></Slider.Root><div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>5억</span><span>50억</span></div></div>
        <div className="mt-6"><label className="mb-2.5 block text-xs font-bold text-slate-600">정책 기간</label><div className="grid grid-cols-3 gap-2">{['3개월','6개월','1년'].map(p=><button key={p} onClick={()=>setPeriod(p)} className={`rounded-xl border py-2.5 text-xs font-bold transition ${period===p?'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200':'border-slate-200 bg-white text-slate-500 hover:border-blue-200'}`}>{period===p&&<Check size={12} className="mr-1 inline"/>}{p}</button>)}</div></div>
        <Button onClick={run} disabled={loading} className="mt-7 h-[52px] w-full bg-slate-950 text-white shadow-xl shadow-slate-200 hover:-translate-y-0.5 hover:bg-blue-600">{loading?<><LoaderCircle className="animate-spin" size={18}/>AI 분석 중...</>:<><Sparkles size={18}/>AI 정책 시뮬레이션<ArrowUpRight size={17}/></>}</Button>
        {loading&&<div className="mt-4"><div className="mb-2 flex justify-between text-[10px] font-semibold text-slate-400"><span>1,248만 건의 데이터를 분석하고 있어요</span><span>약 3초</span></div><div className="h-1 overflow-hidden rounded-full bg-slate-100"><motion.div initial={{width:0}} animate={{width:'100%'}} transition={{duration:3,ease:'linear'}} className="h-full bg-blue-500"/></div></div>}
      </div></Card>
      <Card className={`relative overflow-hidden p-6 transition sm:p-8 ${done?'border-blue-200 shadow-[0_20px_60px_rgba(37,99,235,.12)]':''}`}>
        <AnimatePresence mode="wait">{!done ? <motion.div key="empty" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex h-full min-h-[430px] flex-col items-center justify-center text-center"><div className="relative grid h-24 w-24 place-items-center rounded-[32px] bg-slate-50 text-slate-300"><Bot size={42}/><span className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white shadow-lg"><Sparkles size={14}/></span></div><h3 className="mt-6 text-xl font-bold text-slate-800">시뮬레이션 결과가 여기에 표시됩니다</h3><p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">정책과 예산, 기간을 선택하면<br/>AI가 가장 현실적인 성과를 예측합니다.</p></motion.div> : <motion.div key="result" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.5}}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em] text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]"/>Simulation Complete</div><h3 className="mt-1.5 text-2xl font-bold tracking-tight">예상 정책 효과</h3><p className="mt-1 text-xs text-slate-400">{policyCopy[policy]} · {budget[0]}억 원 · {period}</p></div><div className="rounded-xl bg-emerald-50 px-3 py-2 text-right"><p className="text-[9px] font-bold text-emerald-600">지역경제 효과</p><p className="text-sm font-extrabold text-emerald-700">매우 높음</p></div></div>
          <div className="mt-6 grid grid-cols-2 gap-3">{metrics.map((m,i)=><motion.div key={m.label} initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} transition={{delay:i*.08}} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className={`grid h-8 w-8 place-items-center rounded-lg ${m.color}`}><m.icon size={15}/></div><p className="mt-4 text-[11px] font-medium text-slate-400">{m.label}</p><p className={`mt-0.5 text-2xl font-bold tracking-tight ${m.value.startsWith('-')?'text-emerald-600':'text-slate-950'}`}>{m.value}</p></motion.div>)}</div>
          <div className="mt-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white"><div className="flex items-center gap-2 text-xs font-bold text-blue-300"><Bot size={15}/>ON:GIL AI 추천 이유</div><p className="mt-3 text-[13px] leading-6 text-slate-300">광주의 강점인 문화예술 자원은 야간 체류로 연결될 때 소비 효과가 가장 큽니다. 2030 세대의 선호가 높은 미디어아트와 로컬마켓을 결합하면, 도심 혼잡을 분산하면서 체류시간과 재방문 의향을 함께 높일 수 있어요.</p></div>
        </motion.div>}</AnimatePresence>
      </Card>
    </div>
  </section>
}
