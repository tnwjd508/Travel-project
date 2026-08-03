import { ArrowUpRight, Bot, MapPin, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

export function Hero() {
  return <motion.section initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.65}} className="hero-grid relative overflow-hidden rounded-[30px] bg-slate-950 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,.2)] sm:p-8 lg:p-10">
    <div className="relative z-10 max-w-2xl">
      <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-[11px] font-semibold text-blue-100 backdrop-blur"><Sparkles size={13} className="text-blue-400"/>ON:GIL AI가 방금 분석을 완료했습니다<span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"/></div>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-400"><MapPin size={15} className="text-blue-400"/>광주광역시 · 실시간 관광 데이터</div>
      <h1 className="mt-3 text-[38px] font-bold leading-[1.12] tracking-[-.055em] sm:text-[48px] lg:text-[55px]">지역의 가능성을 읽고,<br/><span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">다음 성장을 설계합니다.</span></h1>
      <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-[15px]">관광 데이터 1,248만 건을 분석해 광주의 현재를 진단했습니다.<br className="hidden sm:block"/>지금 가장 효과적인 정책 시나리오를 확인해 보세요.</p>
      <button onClick={()=>document.getElementById('simulation')?.scrollIntoView({behavior:'smooth'})} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50">AI 전략 시뮬레이션 시작<ArrowUpRight size={16}/></button>
    </div>
    <div className="absolute -right-12 -top-16 h-[370px] w-[370px] rounded-full bg-blue-600/20 blur-3xl"/>
    <div className="absolute right-[-45px] top-1/2 hidden h-[340px] w-[340px] -translate-y-1/2 lg:block">
      <motion.div animate={{rotate:360}} transition={{duration:32,repeat:Infinity,ease:'linear'}} className="absolute inset-0 rounded-full border border-dashed border-blue-300/20"><span className="absolute left-1/2 top-[-5px] h-2.5 w-2.5 rounded-full bg-blue-400 shadow-[0_0_18px_#60a5fa]"/></motion.div>
      <motion.div animate={{rotate:-360}} transition={{duration:22,repeat:Infinity,ease:'linear'}} className="absolute inset-12 rounded-full border border-white/10"><span className="absolute bottom-5 left-5 h-2 w-2 rounded-full bg-violet-400"/></motion.div>
      <div className="absolute inset-24 grid place-items-center rounded-full border border-blue-400/30 bg-blue-500/10 shadow-[inset_0_0_40px_rgba(37,99,235,.2)] backdrop-blur"><div className="grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_15px_40px_rgba(37,99,235,.45)]"><Bot size={37}/></div></div>
      {[['top-[26px] left-[32px]','문화'],['right-0 top-[145px]','소비'],['bottom-[8px] left-[102px]','체류']].map(([pos,text])=><div key={text} className={`absolute ${pos} rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-[10px] font-bold text-slate-300 backdrop-blur`}>{text} 데이터</div>)}
    </div>
  </motion.section>
}
