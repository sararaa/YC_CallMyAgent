'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useOperatorStore } from '@/store/operatorStore'
import { useCallStore } from '@/store/callStore'
import { cn } from '@/lib/utils'
import type { MemoryCard, MemoryTier } from '@/lib/voltTypes'

function fmtMs(ms: number): string {
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const LANES: Array<{
  tier: MemoryTier
  label: string
  sub: (phone: string | null) => string
  accent: string
  glow: string
}> = [
  { tier: 'session',   label: 'SESSION CACHE', sub: () => 'Moss · current session · <10ms', accent: 'text-cyan-electric',   glow: 'shadow-[0_0_20px_rgba(0,212,255,0.10)]' },
  { tier: 'knowledge', label: 'KNOWLEDGE',     sub: () => 'Moss · volt-kb · <10ms',          accent: 'text-violet-electric', glow: 'shadow-[0_0_20px_rgba(124,58,237,0.10)]' },
  { tier: 'long_term', label: 'LONG-TERM',     sub: (p) => `Supermemory · ${p || '—'} · ~80ms`, accent: 'text-amber-warn',    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.10)]' },
]

function Card({ tier, cards, accent }: { tier: MemoryTier; cards: MemoryCard[]; accent: string }) {
  return (
    <AnimatePresence initial={false}>
      {cards.map((c) => (
        <motion.div
          key={c.id}
          layoutId={c.id}
          initial={{
            opacity: 0,
            x: tier === 'long_term' ? 24 : tier === 'session' ? -24 : 0,
            y: tier === 'knowledge' ? -8 : 0,
          }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-[12px] leading-snug text-slate-200 line-clamp-2')}>{c.text}</p>
            <span className={cn('h-1.5 w-1.5 rounded-full mt-1 flex-none', c.hit ? 'bg-green-neon' : 'bg-slate-600')} />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-500 font-mono">
            <span className="truncate max-w-[70%]">{c.source || '—'}</span>
            <span>{fmtMs(c.latencyMs)}</span>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

export function MemoryWall() {
  const memory = useOperatorStore((s) => s.memory)
  const callerPhone = useCallStore((s) => s.callerId)

  return (
    <div className="glass rounded-xl panel-shadow flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-electric/20 to-violet-electric/10 flex items-center justify-center">
          <span className="text-violet-electric text-[10px] font-bold tracking-widest">MEM</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Memory Wall</p>
          <p className="text-[10px] text-slate-500">Three tiers · preload from cold to hot</p>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-3 gap-2 p-2 min-h-0">
        {LANES.map((l) => (
          <div key={l.tier} className={cn('flex flex-col rounded-lg border border-white/[0.06] bg-white/[0.01] overflow-hidden', l.glow)}>
            <div className="px-2 py-1.5 border-b border-white/[0.06]">
              <p className={cn('text-[10px] font-bold tracking-widest', l.accent)}>{l.label}</p>
              <p className="text-[9.5px] text-slate-500 font-mono">{l.sub(callerPhone)}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 min-h-0">
              <Card tier={l.tier} cards={memory[l.tier]} accent={l.accent} />
              {memory[l.tier].length === 0 && (
                <div className="text-[10px] text-slate-600 text-center py-4">Idle.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
