import {
  Banknote,
  BrainCircuit,
  ChartNoAxesCombined,
  Clock3,
  FileText,
  FlaskConical,
  GitCompareArrows,
  MapPinned,
  MoonStar,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface BriefingSignal {
  id: string
  title: string
  description: string
  icon: LucideIcon
  tone: 'blue' | 'violet' | 'orange'
}

export interface KpiData {
  id: string
  label: string
  value: number
  suffix: string
  decimals?: number
  changeText: string
  icon: LucideIcon
  accent: 'violet' | 'blue' | 'green' | 'orange'
  chartData: number[]
}

export interface QuickMenuItem {
  id: string
  title: string
  subtitle: string
  path: string
  icon: LucideIcon
}

export const briefingSignals: BriefingSignal[] = [
  {
    id: 'young-visitors',
    title: '2030 관광객 유입 감소',
    description: '전년 대비 -12.4% 감소',
    icon: Users,
    tone: 'blue',
  },
  {
    id: 'night-stay',
    title: '야간 체류 부족',
    description: '야간 관광 비중 18.7%로 낮음',
    icon: MoonStar,
    tone: 'violet',
  },
  {
    id: 'concentration',
    title: '특정 관광지 집중',
    description: '상위 3개 관광지 방문 비중 62%',
    icon: MapPinned,
    tone: 'orange',
  },
]

export const overviewKpis: KpiData[] = [
  {
    id: 'visitors',
    label: '월 관광객',
    value: 1254320,
    suffix: '명',
    changeText: '전월 대비 ▲ 12.4%',
    icon: Users,
    accent: 'violet',
    chartData: [24, 29, 27, 34, 38, 43, 51],
  },
  {
    id: 'stay-time',
    label: '평균 체류시간',
    value: 2.8,
    suffix: '시간',
    decimals: 1,
    changeText: '전월 대비 ▲ 0.3시간',
    icon: Clock3,
    accent: 'blue',
    chartData: [2.1, 2.2, 2.35, 2.4, 2.55, 2.62, 2.8],
  },
  {
    id: 'spending',
    label: '관광 소비',
    value: 3249,
    suffix: '억원',
    changeText: '전월 대비 ▲ 8.7%',
    icon: Banknote,
    accent: 'green',
    chartData: [2440, 2510, 2630, 2790, 2870, 3060, 3249],
  },
  {
    id: 'growth-index',
    label: '관광 성장 지수',
    value: 74.2,
    suffix: '점',
    decimals: 1,
    changeText: '전월 대비 ▲ 6.2점',
    icon: TrendingUp,
    accent: 'orange',
    chartData: [52, 56, 55, 62, 65, 69, 74.2],
  },
]

export const quickMenuItems: QuickMenuItem[] = [
  {
    id: 'analytics',
    title: '관광 데이터',
    subtitle: '상세히 보기',
    path: '/dashboard/gwangju/analytics',
    icon: ChartNoAxesCombined,
  },
  {
    id: 'diagnosis',
    title: 'AI 지역 진단',
    subtitle: '진단 결과 보기',
    path: '/dashboard/gwangju/diagnosis',
    icon: BrainCircuit,
  },
  {
    id: 'simulation',
    title: '정책 시뮬레이션',
    subtitle: '시뮬레이션 시작',
    path: '/dashboard/gwangju/simulation',
    icon: FlaskConical,
  },
  {
    id: 'strategy',
    title: '전략 비교',
    subtitle: '전략 비교하기',
    path: '/dashboard/gwangju/strategy',
    icon: GitCompareArrows,
  },
  {
    id: 'report',
    title: 'AI 보고서',
    subtitle: '보고서 생성',
    path: '/dashboard/gwangju/report',
    icon: FileText,
  },
]
