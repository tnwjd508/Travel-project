import {
  BrainCircuit,
  ChartNoAxesCombined,
  FileText,
  FlaskConical,
  GitCompareArrows,
  type LucideIcon,
} from 'lucide-react'

export interface QuickMenuItem {
  id: string
  title: string
  subtitle: string
  path: string
  icon: LucideIcon
}

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
