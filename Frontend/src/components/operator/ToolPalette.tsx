'use client'
import { motion } from 'framer-motion'
import { useOperatorStore } from '@/store/operatorStore'
import { ALL_TOOLS, TOOL_CATEGORY, type ToolName } from '@/lib/voltTypes'
import { cn } from '@/lib/utils'

const LABEL: Record<ToolName, string> = {
  recall_session: 'recall_session',
  recall_knowledge: 'recall_knowledge',
  get_charger_telemetry: 'get_charger_telemetry',
  send_remote_command: 'send_remote_command',
  create_work_order: 'create_work_order',
  generate_report: 'generate_report',
  advance_to_scoping: '→ scoping',
  advance_to_triage: '→ triage',
  route_to_user_issue: '→ user',
  route_to_software_issue: '→ software',
  route_to_hardware_issue: '→ hardware',
  advance_to_wrap_up: '→ wrap_up',
  end_call: 'end_call',
}

const ACCENT = {
  memory: 'text-violet-electric border-violet-electric/30',
  telemetry: 'text-cyan-electric border-cyan-electric/30',
  action: 'text-amber-warn border-amber-warn/30',
  transition: 'text-green-neon border-green-neon/30',
} as const

export function ToolPalette() {
  const toolStates = useOperatorStore((s) => s.toolStates)
  const toolsAvailable = useOperatorStore((s) => s.toolsAvailable)
  const available = new Set(toolsAvailable)

  const sorted = [...ALL_TOOLS].sort((a, b) => {
    const aAv = available.has(a) ? 0 : 1
    const bAv = available.has(b) ? 0 : 1
    if (aAv !== bAv) return aAv - bAv
    return a.localeCompare(b)
  })

  return (
    <div className="glass rounded-xl panel-shadow flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-warn/20 to-amber-warn/10 flex items-center justify-center">
          <span className="text-amber-warn text-[10px] font-bold tracking-widest">TX</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Tool Palette</p>
          <p className="text-[10px] text-slate-500">{toolsAvailable.length} / {ALL_TOOLS.length} available this turn</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1.5 content-start min-h-0">
        {sorted.map((t) => {
          const isAvail = available.has(t)
          const fire = toolStates[t]
          const cat = TOOL_CATEGORY[t]
          return (
            <motion.div
              key={t}
              layout
              transition={{ duration: 0.3 }}
              className={cn(
                'relative rounded-md border px-2 py-1.5 flex flex-col gap-0.5',
                isAvail ? 'bg-white/[0.03]' : 'bg-white/[0.01] opacity-40',
                isAvail ? ACCENT[cat] : 'border-white/[0.04]',
              )}
              animate={fire === 'firing' ? { backgroundColor: 'rgba(0,212,255,0.10)' } : {}}
            >
              <p className={cn('font-mono text-[10.5px] truncate', isAvail ? 'text-slate-200' : 'text-slate-600')}>{LABEL[t]}</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">{cat}</p>
              {fire === 'firing' && (
                <motion.span
                  className="absolute inset-0 rounded-md border-2 border-cyan-electric pointer-events-none"
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                />
              )}
              {fire === 'ok' && <span className="absolute top-1 right-1.5 text-[9px] text-green-neon">✓</span>}
              {fire === 'error' && <span className="absolute top-1 right-1.5 text-[9px] text-red-critical">!</span>}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
