export interface MonthlyVisitor { month: string; visitors: number; previous: number }
export interface AgeVisitor { age: string; value: number }
export interface TourismType { name: string; value: number; color: string }
export interface Policy { id: string; name: string; effect: number; budget: string; difficulty: string; score: number; recommended?: boolean }
export interface Attraction { name: string; category: string; lng: number; lat: number; visitors: string; accent: string }
