'use client'
import { useOperatorStore } from '@/store/operatorStore'
import { cn } from '@/lib/utils'

function dots(value: number) {
  const filled = Math.max(1, Math.min(5, Math.round(value * 5)))
  const color =
    value < 0.2 ? 'bg-red-critical' :
    value < 0.6 ? 'bg-amber-warn' :
    'bg-cyan-electric'
  return (
    <span className="inline-flex gap-[3px]">
      {[0,1,2,3,4].map((i) => (
        <span key={i} className={cn('h-[6px] w-[6px] rounded-full', i < filled ? color : 'bg-white/[0.08]')} />
      ))}
    </span>
  )
}

export function AgentDecisionPanel() {
  const d = useOperatorStore((s) => s.lastDecision)
  const toolsAvailable = useOperatorStore((s) => s.toolsAvailable)

  return (
    <div className="glass rounded-xl panel-shadow p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-bold tracking-widest text-cyan-electric">GEMINI · AGENT LOOP</p>
        <p className="text-[10px] text-slate-500 font-mono">2.5 Flash</p>
      </div>
      <div className="h-px bg-white/[0.06] my-2" />
      <p className="text-[10px] uppercase tracking-wider text-slate-500">Last decision</p>
      {d ? (
        <>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="font-mono text-[11.5px] text-slate-200 truncate">{d.tool}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-300">{d.confidence != null ? d.confidence.toFixed(2) : '—'}</span>
              {d.confidence != null && dots(d.confidence)}
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 italic" title={d.reason || ''}>{d.reason || '—'}</p>
        </>
      ) : (
        <p className="mt-1 text-[11px] text-slate-500">No decisions yet.</p>
      )}
      <div className="h-px bg-white/[0.06] my-2" />
      <p className="text-[10.5px] text-slate-500 font-mono">{toolsAvailable.length} tools available this turn</p>
    </div>
  )
}
