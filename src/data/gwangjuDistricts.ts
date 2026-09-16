export type DistrictSlug = 'donggu' | 'seogu' | 'namgu' | 'bukgu' | 'gwangsangu'

export interface DistrictMetrics {
  visitors: number
  stayTime: number
  spending: number
  growthIndex: number
}

export interface GwangjuDistrict {
  slug: DistrictSlug
  code: string
  nameKo: string
  nameEn: string
  description: string
  tourismType: string
  score: number
  attractionCount: number
  dashboardPath: string
  status: 'available' | 'coming-soon'
  metrics: DistrictMetrics
}

export const gwangjuDistricts: GwangjuDistrict[] = [
  {
    slug: 'donggu',
    code: '24010',
    nameKo: '동구',
    nameEn: 'Dong-gu',
    description: '문화·역사·도심 관광이 연결되는 광주의 핵심 관광지',
    tourismType: '문화·역사 관광',
    score: 81,
    attractionCount: 12,
    dashboardPath: '/dashboard/gwangju/donggu/overview',
    status: 'available',
    metrics: { visitors: 286430, stayTime: 3.1, spending: 862, growthIndex: 81 },
  },
  {
    slug: 'seogu',
    code: '24020',
    nameKo: '서구',
    nameEn: 'Seo-gu',
    description: '상무지구와 도심 생활관광이 결합된 지역',
    tourismType: '도심·생활 관광',
    score: 73,
    attractionCount: 8,
    dashboardPath: '/dashboard/gwangju/seogu/overview',
    status: 'available',
    metrics: { visitors: 214680, stayTime: 2.5, spending: 711, growthIndex: 73 },
  },
  {
    slug: 'namgu',
    code: '24030',
    nameKo: '남구',
    nameEn: 'Nam-gu',
    description: '양림동을 중심으로 근대문화와 예술이 이어지는 지역',
    tourismType: '근대문화 관광',
    score: 78,
    attractionCount: 10,
    dashboardPath: '/dashboard/gwangju/namgu/overview',
    status: 'available',
    metrics: { visitors: 238920, stayTime: 2.9, spending: 756, growthIndex: 78 },
  },
  {
    slug: 'bukgu',
    code: '24040',
    nameKo: '북구',
    nameEn: 'Buk-gu',
    description: '무등산과 생태자원을 활용할 수 있는 자연관광 지역',
    tourismType: '생태·자연 관광',
    score: 76,
    attractionCount: 9,
    dashboardPath: '/dashboard/gwangju/bukgu/overview',
    status: 'available',
    metrics: { visitors: 265710, stayTime: 3.3, spending: 694, growthIndex: 76 },
  },
  {
    slug: 'gwangsangu',
    code: '24050',
    nameKo: '광산구',
    nameEn: 'Gwangsan-gu',
    description: '광주송정역과 전통시장을 중심으로 접근성이 우수한 지역',
    tourismType: '교통·시장 관광',
    score: 75,
    attractionCount: 11,
    dashboardPath: '/dashboard/gwangju/gwangsangu/overview',
    status: 'available',
    metrics: { visitors: 248580, stayTime: 2.7, spending: 826, growthIndex: 75 },
  },
]

const districtBySlug = new Map(gwangjuDistricts.map((district) => [district.slug, district]))

export function isDistrictSlug(value: string | undefined): value is DistrictSlug {
  return Boolean(value && districtBySlug.has(value as DistrictSlug))
}

export function getGwangjuDistrict(value: string | undefined) {
  return isDistrictSlug(value) ? districtBySlug.get(value) ?? null : null
}

export function getDistrictDashboardPath(slug: DistrictSlug, section = 'overview') {
  return `/dashboard/gwangju/${slug}/${section}`
}
