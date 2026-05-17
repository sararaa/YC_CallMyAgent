'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { useOperatorStore } from '@/store/operatorStore'
import { TOOL_CATEGORY, type ToolName } from '@/lib/voltTypes'
import { cn } from '@/lib/utils'

const CAT_BG: Record<ReturnType<typeof catKey>, string> = {
  memory: 'bg-violet-electric/15 text-violet-electric border-violet-electric/30',
  telemetry: 'bg-cyan-electric/15 text-cyan-electric border-cyan-electric/30',
  action: 'bg-amber-warn/15 text-amber-warn border-amber-warn/30',
  transition: 'bg-green-neon/10 text-green-neon border-green-neon/30',
}
function catKey(tool: ToolName) { return TOOL_CATEGORY[tool] }

function ConfidenceDots({ value }: { value: number | null | undefined }) {
  if (value == null) return null
  const filled = Math.max(1, Math.min(5, Math.round(value * 5)))
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      <span className="inline-flex gap-[2px]">
        {[0,1,2,3,4].map((i) => (
          <span key={i} className={cn('h-[5px] w-[5px] rounded-full', i < filled ? 'bg-current' : 'bg-current opacity-25')} />
        ))}
      </span>
      <span className="text-[10px] font-mono">{value.toFixed(2)}</span>
    </span>
  )
}

export function AgentTranscript() {
  const transcript = useOperatorStore((s) => s.transcript)
  const [open, setOpen] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom on new turns when the toggle is on.
  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [transcript.length, autoScroll])

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }

  return (
    <div className="glass rounded-xl panel-shadow flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-neon/20 to-green-neon/10 flex items-center justify-center">
          <span className="text-green-neon text-[10px] font-bold tracking-widest">TR</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Live Transcript</p>
          <p className="text-[10px] text-slate-500">Caller · Agent · Tool calls inline</p>
        </div>
        <button
          onClick={() => { setAutoScroll((v) => !v); if (!autoScroll) scrollToBottom() }}
          title={autoScroll ? 'Auto-scroll on — click to pause' : 'Auto-scroll off — click to resume + jump to bottom'}
          className={cn(
            'inline-flex items-center gap-1 text-[10px] uppercase tracking-widest border rounded-md px-2 py-1 transition-colors',
            autoScroll
              ? 'bg-green-neon/10 text-green-neon border-green-neon/30 hover:bg-green-neon/20'
              : 'bg-white/[0.03] text-slate-500 border-white/[0.08] hover:text-slate-300',
          )}
        >
          <ArrowDown className="w-3 h-3" />
          {autoScroll ? 'Auto' : 'Paused'}
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {transcript.length === 0 && (
          <div className="text-center text-slate-600 text-xs py-8">No turns yet.</div>
        )}
        {transcript.map((item) => {
          if (item.kind === 'turn') {
            const isAgent = item.role === 'agent'
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn('flex flex-col gap-1', isAgent ? 'items-start' : 'items-end')}
              >
                <span className={cn(
                  'text-[10px] uppercase tracking-widest px-1',
                  isAgent ? 'text-cyan-electric/70' : 'text-violet-electric/70',
                )}>
                  {isAgent ? 'Agent' : 'Caller'}
                </span>
                <div className={cn(
                  'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed border shadow-sm',
                  isAgent
                    ? 'bg-cyan-electric/[0.08] border-cyan-electric/25 text-slate-100 rounded-bl-md'
                    : 'bg-violet-electric/[0.10] border-violet-electric/30 text-slate-100 rounded-br-md',
                )}>
                  {item.text}
                </div>
              </motion.div>
            )
          }
          const cat = catKey(item.tool)
          return (
            <div key={item.id} className="flex items-start gap-2">
              <button onClick={() => setOpen(open === item.id ? null : item.id)} className="focus:outline-none">
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-mono',
                  CAT_BG[cat],
                )}>
                  <span>{item.tool}</span>
                  {item.duration_ms != null && (
                    <span className="opacity-70">{Math.round(item.duration_ms)}ms</span>
                  )}
                  {item.ok === false && <span>!</span>}
                  <ConfidenceDots value={item.confidence} />
                </span>
              </button>
              <AnimatePresence>
                {open === item.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="ml-1 text-[11px] text-slate-400 overflow-hidden"
                  >
                    {item.reason && <div className="italic mb-0.5">“{item.reason}”</div>}
                    {item.result_preview && (
                      <div className="font-mono text-[10.5px] text-slate-500">→ {item.result_preview}</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
