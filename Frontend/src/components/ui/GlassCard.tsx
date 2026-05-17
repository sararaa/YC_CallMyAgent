'use client'
import { cn } from '@/lib/utils'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  glowColor?: string
  style?: React.CSSProperties
  onClick?: () => void
}

export function GlassCard({ children, className, glowColor, style, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass rounded-xl p-4 transition-all duration-300',
        onClick && 'cursor-pointer hover:-translate-y-1 hover:border-white/15',
        className
      )}
      style={{
        ...(glowColor ? { boxShadow: `0 0 20px ${glowColor}20, 0 4px 24px rgba(0,0,0,0.4)` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
