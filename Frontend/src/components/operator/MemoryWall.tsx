'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useOperatorStore } from '@/store/operatorStore'
import { useCallStore } from '@/store/callStore'
import { cn } from '@/lib/utils'
import type { MemoryCard, MemoryTier } from '@/lib/voltTypes'
import { Database } from 'lucide-react'

function fmtMs(ms: number): string {
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const LANES: Array<{
  tier: MemoryTier
  label: string
  sub: (phone: string | null) => string
  dot: string
  ring: string
}> = [
  {
    tier: 'session',
    label: 'Session cache',
    sub: () => 'Moss · active session · <10ms',
    dot: 'bg-cyan-electric',
    ring: 'border-cyan-electric/20',
  },
  {
    tier: 'knowledge',
    label: 'Knowledge base',
    sub: () => 'Moss · volt-kb · <10ms',
    dot: 'bg-violet-electric',
    ring: 'border-violet-electric/20',
  },
  {
    tier: 'long_term',
    label: 'Long-term',
    sub: (p) => `Supermemory · ${p ?? '—'} · ~80ms`,
    dot: 'bg-amber-warn',
    ring: 'border-amber-warn/20',
  },
]

function MemoryChunk({ card, tier }: { card: MemoryCard; tier: MemoryTier }) {
  return (
    <motion.div
      key={card.id}
      layoutId={card.id}
      initial={{
        opacity: 0,
        x: tier === 'long_term' ? 20 : tier === 'session' ? -20 : 0,
        y: tier === 'knowledge' ? -6 : 0,
      }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 240, damping: 24 }}
      className="bg-bg-base border border-border rounded-md p-2.5 group"
    >
      <div className="flex items-start gap-2">
        <p className="text-[11.5px] text-text-secondary leading-snug line-clamp-2 flex-1">{card.text}</p>
        <span className={cn('w-1.5 h-1.5 rounded-full mt-1 shrink-0', card.hit ? 'bg-green-neon' : 'bg-text-muted opacity-40')} />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[15px] font-mono text-text-muted truncate max-w-[70%]">{card.source || '—'}</span>
        <span className="text-[15px] font-mono text-text-muted">{fmtMs(card.latencyMs)}</span>
      </div>
    </motion.div>
  )
}

export function MemoryWall() {
  const memory = useOperatorStore((s) => s.memory)
  const callerPhone = useCallStore((s) => s.callerId)

  return (
    <div className="panel panel-shadow flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <Database className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-[15px] font-medium text-text-primary">Memory</span>
        <span className="text-[15px] text-text-muted">· three-tier cache</span>
      </div>

      <div className="flex-1 grid grid-cols-3 divide-x divide-border min-h-0">
        {LANES.map((lane) => (
          <div key={lane.tier} className="flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', lane.dot)} />
              <div>
                <p className="text-[15px] font-medium text-text-secondary">{lane.label}</p>
                <p className="text-[15px] font-mono text-text-muted">{lane.sub(callerPhone)}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
              <AnimatePresence initial={false}>
                {memory[lane.tier].map((card) => (
                  <MemoryChunk key={card.id} card={card} tier={lane.tier} />
                ))}
              </AnimatePresence>
              {memory[lane.tier].length === 0 && (
                <p className="text-[15px] text-text-muted text-center py-6">Empty</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
