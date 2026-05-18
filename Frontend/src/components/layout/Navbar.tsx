'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bird } from 'lucide-react'
import { useCallStore } from '@/store/callStore'
import { formatDuration, cn } from '@/lib/utils'
import { useEffect } from 'react'
import { useWsStatus } from '@/lib/wsBridge'

export function Navbar() {
  const pathname = usePathname()
  const { status, duration } = useCallStore()
  const wsStatus = useWsStatus((s) => s.status)
  const isLive = status === 'active'

  useEffect(() => {
    document.title = isLive ? '● Live — PigeonPlatform' : 'PigeonPlatform'
  }, [isLive])

  return (
    <nav className="h-12 border-b border-border bg-bg-base shrink-0 sticky top-0 z-50">
      <div className="flex items-center h-full px-4 gap-1">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-4">
          <div className="w-6 h-6 rounded-md bg-cyan-electric flex items-center justify-center">
            <Bird className="w-3.5 h-3.5 text-white" strokeWidth={2} />
          </div>
          <span className="font-semibold text-base text-text-primary tracking-tight">PigeonPlatform</span>
        </Link>

        {/* Nav links */}
        <Link
          href="/"
          className={cn(
            'text-[15px] px-2.5 py-1 rounded-md transition-colors',
            pathname === '/'
              ? 'text-text-primary bg-bg-hover'
              : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
          )}
        >
          Operator
        </Link>
        <Link
          href="/work-orders"
          className={cn(
            'text-[15px] px-2.5 py-1 rounded-md transition-colors',
            pathname.startsWith('/work-orders')
              ? 'text-text-primary bg-bg-hover'
              : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
          )}
        >
          Work Orders
        </Link>

        <div className="flex-1" />

        {/* Live indicator */}
        {isLive ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-red-950/50 border border-red-900/60">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-live" />
            <span className="text-red-400 text-[15px] font-medium tabular-nums">{formatDuration(duration)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full', {
              'bg-green-neon': wsStatus === 'open',
              'bg-amber-warn': wsStatus === 'connecting',
              'bg-red-critical': wsStatus === 'closed',
            })} />
            <span className="text-text-muted text-[15px]">
              {wsStatus === 'open' ? 'Connected' : wsStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
            </span>
          </div>
        )}

        {/* Avatar */}
        <div className="w-6 h-6 rounded-full bg-bg-card border border-border flex items-center justify-center text-[15px] font-semibold text-text-secondary ml-3">
          S
        </div>
      </div>
    </nav>
  )
}
