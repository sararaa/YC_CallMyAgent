'use client'
import { cn } from '@/lib/utils'
import { ChargerStatus } from '@/lib/types'

const colors: Record<ChargerStatus, string> = {
  online: '#00ff88',
  degraded: '#f59e0b',
  offline: '#ef4444',
}

export function StatusDot({ status, className }: { status: ChargerStatus; className?: string }) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: colors[status] }}
      />
      {status === 'online' && (
        <span
          className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-60"
          style={{ backgroundColor: colors[status] }}
        />
      )}
    </span>
  )
}
