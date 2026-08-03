import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-surface rounded-[24px] border border-white/80 bg-white/80 shadow-card backdrop-blur-xl transition-all duration-300', className)} {...props} />
}
