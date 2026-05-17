'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap } from 'lucide-react'
import { useCallStore } from '@/store/callStore'
import { formatDuration, cn } from '@/lib/utils'
import { useEffect } from 'react'

export function Navbar() {
  const pathname = usePathname()
  const { status, duration } = useCallStore()
  const isLive = status === 'active'

  useEffect(() => {
    document.title = isLive
      ? `🔴 Live Call — ChargePulse`
      : 'ChargePulse — EV Diagnostics'
  }, [isLive])

  return (
    <nav className="glass border-b border-white/[0.06] sticky top-0 z-50 h-14">
      <div className="flex items-center h-full px-4 gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-2">
          <div className="relative">
            <Zap className="w-6 h-6 text-cyan-electric drop-shadow-[0_0_8px_#00d4ff]" fill="#00d4ff" />
          </div>
          <span className="font-bold text-lg tracking-tight gradient-text">ChargePulse</span>
        </Link>

        {/* Live wire badge */}
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-cyan-electric/15 text-cyan-electric border border-cyan-electric/30">
          Volt · AgentPhone
        </span>

        <div className="flex-1" />

        {/* Live indicator */}
        {isLive && (
          <div className="flex items-center gap-2 bg-red-950/50 border border-red-500/30 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-live" />
            <span className="text-red-400 text-xs font-bold tracking-widest">LIVE</span>
            <span className="text-red-300 text-xs font-mono ml-1">{formatDuration(duration)}</span>
          </div>
        )}

        {/* Nav links */}
        <Link
          href="/"
          className={cn(
            'text-sm font-medium px-3 py-1.5 rounded-lg transition-colors',
            pathname === '/'
              ? 'bg-white/10 text-white'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          )}
        >
          Operator
        </Link>
        <Link
          href="/work-orders"
          className={cn(
            'text-sm font-medium px-3 py-1.5 rounded-lg transition-colors',
            pathname.startsWith('/work-orders')
              ? 'bg-white/10 text-white'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          )}
        >
          Work Orders
        </Link>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-electric to-violet-electric flex items-center justify-center text-xs font-bold text-white ml-1">
          SH
        </div>
      </div>
    </nav>
  )
}
