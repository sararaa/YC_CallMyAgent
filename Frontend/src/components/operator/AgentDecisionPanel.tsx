'use client'
import { useOperatorStore } from '@/store/operatorStore'
import { cn } from '@/lib/utils'
import { Cpu } from 'lucide-react'

function ConfBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const barColor =
    value < 0.4 ? 'bg-red-critical' :
    value < 0.7 ? 'bg-amber-warn' :
    'bg-cyan-electric'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-bg-hover rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[15px] font-mono text-text-muted tabular-nums w-7 text-right">{pct}%</span>
    </div>
  )
}

export function AgentDecisionPanel() {
  const d = useOperatorStore((s) => s.lastDecision)
  const toolsAvailable = useOperatorStore((s) => s.toolsAvailable)

  return (
    <div className="panel p-3 shrink-0">
      <div className="flex items-center gap-2 mb-2.5">
        <Cpu className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-[15px] font-medium text-text-primary">Agent loop</span>
        <span className="ml-auto text-[15px] text-text-muted font-mono">Gemini 2.5 Flash</span>
      </div>

      {d ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-mono text-cyan-electric bg-cyan-electric/10 border border-cyan-electric/20 px-2 py-0.5 rounded truncate">
              {d.tool}
            </span>
            <span className="text-[15px] text-text-muted shrink-0">
              {toolsAvailable.length} tools
            </span>
          </div>
          {d.confidence != null && <ConfBar value={d.confidence} />}
          {d.reason && (
            <p className="text-[15px] text-text-muted leading-relaxed line-clamp-2 italic">
              "{d.reason}"
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-[15px] text-text-muted">No decisions yet</p>
          <span className="text-[15px] text-text-muted">{toolsAvailable.length} tools available</span>
        </div>
      )}
    </div>
  )
}
