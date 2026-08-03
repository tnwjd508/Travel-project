import { Banknote, Clock3, Route, Sparkles, TrendingUp, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { Hero } from '@/components/dashboard/Hero'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { DiagnosisCard } from '@/components/dashboard/DiagnosisCard'
import { TourismCharts, RegionRadar } from '@/components/dashboard/TourismCharts'
import { Simulation } from '@/components/dashboard/Simulation'
import { StrategyTable } from '@/components/dashboard/StrategyTable'
import { TourismMap } from '@/components/dashboard/TourismMap'
import { ImpactTimeline } from '@/components/dashboard/ImpactTimeline'
import { SectionTitle } from '@/components/ui/SectionTitle'

export function Dashboard() {
  return <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.4}} className="space-y-14 lg:space-y-20">
    <section className="space-y-5"><Hero/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label="월 관광객" value={482000} suffix="명" change={8.7} icon={Users} data={[22,26,24,31,34,39,42]}/><KpiCard label="평균 체류시간" value={31.8} suffix="시간" decimals={1} change={5.2} icon={Clock3} data={[22,24,25,25,28,29,32]} delay={.06}/><KpiCard label="1인 관광 소비" value={148000} suffix="원" change={11.4} icon={Banknote} data={[31,29,34,36,38,43,49]} delay={.12}/><KpiCard label="관광 성장지수" value={12.4} suffix="점" decimals={1} change={3.1} icon={TrendingUp} data={[19,23,22,27,31,34,38]} delay={.18}/></div></section>
    <section><SectionTitle eyebrow="AI Insight" title="데이터가 말하는 광주의 현재" description="흩어진 관광 데이터를 AI가 진단해, 놓치고 있던 문제와 기회를 발견합니다." icon={Sparkles}/><div className="grid gap-5 xl:grid-cols-[.78fr_1.22fr]"><DiagnosisCard/><TourismCharts/></div></section>
    <section><SectionTitle eyebrow="Policy Simulation" title="정책의 결과를, 시행 전에 확인하세요" description="예산과 기간을 조정하며 가장 효과적인 관광 활성화 전략을 시뮬레이션합니다." icon={Route}/><Simulation/></section>
    <section><SectionTitle eyebrow="Strategy Compare" title="가장 현실적인 선택을 위한 비교" description="기대효과뿐 아니라 예산과 실행 난이도까지 균형 있게 평가했습니다."/><StrategyTable/></section>
    <section><SectionTitle eyebrow="Spatial Intelligence" title="관광의 흐름을 공간으로 읽다" description="방문 집중 지역과 성장 가능성이 높은 숨은 관광지를 함께 탐색합니다."/><TourismMap/></section>
    <section><SectionTitle eyebrow="Future Impact" title="전략이 만드는 변화의 궤적" description="하나의 정책이 관광객과 체류, 소비, 지역경제에 미치는 연쇄 효과입니다."/><div className="grid gap-5 xl:grid-cols-[1fr_360px]"><ImpactTimeline/><RegionRadar/></div></section>
    <footer className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 py-7 text-[11px] text-slate-400 sm:flex-row"><div><b className="text-slate-600">ON<span className="text-blue-600">:</span>GIL</b> · AI가 지역 관광의 길을 제시하다.</div><div>한국관광공사 Tourism Data Lab 연계 · 데이터 기준 2026.07</div></footer>
  </motion.div>
}
