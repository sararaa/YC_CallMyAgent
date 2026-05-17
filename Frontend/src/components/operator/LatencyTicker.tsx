'use client'
import { useOperatorStore } from '@/store/operatorStore'
import { cn } from '@/lib/utils'
import type { LatencyComponent } from '@/lib/voltTypes'

const THRESH: Record<LatencyComponent, number> = {
  gemini: 600, moss_session: 15, moss_kb: 15, supermemory: 120,
}
const LABEL: Record<LatencyComponent, string> = {
  gemini: 'G', moss_session: 'MS', moss_kb: 'MK', supermemory: 'SM',
}

function fmtMs(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function rollingMean(values: number[], n = 5): number | null {
  if (values.length === 0) return null
  const s = values.slice(-n)
  return s.reduce((a, b) => a + b, 0) / s.length
}

function color(component: LatencyComponent, ms: number | null): string {
  if (ms == null) return 'text-slate-500'
  const t = THRESH[component]
  if (ms <= t) return 'text-green-neon'
  if (ms <= t * 2) return 'text-amber-warn'
  return 'text-red-critical'
}

export function LatencyTicker() {
  const latency = useOperatorStore((s) => s.latency)
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-slate-500 uppercase tracking-wider text-[10px]">Latency</span>
      {(Object.keys(LABEL) as LatencyComponent[]).map((c) => {
        const ms = rollingMean(latency[c], 5)
        return (
          <div key={c} className="flex items-baseline gap-1 font-mono">
            <span className="text-slate-500">{LABEL[c]}</span>
            <span className={cn('font-semibold', color(c, ms))}>{fmtMs(ms)}</span>
          </div>
        )
      })}
    </div>
  )
}
