'use client'
import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'cyan' | 'violet' | 'green' | 'amber' | 'red' | 'gray'
  pulse?: boolean
}

const variantClasses = {
  default: 'bg-slate-800 text-slate-300 border border-slate-600/50',
  cyan: 'bg-cyan-950/60 text-cyan-400 border border-cyan-500/30',
  violet: 'bg-violet-950/60 text-violet-400 border border-violet-500/30',
  green: 'bg-green-950/60 text-green-400 border border-green-500/30',
  amber: 'bg-amber-950/60 text-amber-400 border border-amber-500/30',
  red: 'bg-red-950/60 text-red-400 border border-red-500/30',
  gray: 'bg-gray-800/60 text-gray-400 border border-gray-600/30',
}

export function Badge({ children, className, variant = 'default', pulse = false }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono tracking-wider uppercase',
        variantClasses[variant],
        pulse && 'animate-pulse-live',
        className
      )}
    >
      {children}
    </span>
  )
}
