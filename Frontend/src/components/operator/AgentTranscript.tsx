'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import { useOperatorStore } from '@/store/operatorStore'
import { TOOL_CATEGORY, type ToolName } from '@/lib/voltTypes'
import { cn } from '@/lib/utils'

const CAT_STYLES: Record<ReturnType<typeof catKey>, string> = {
  memory:     'bg-violet-electric/10 text-violet-electric border-violet-electric/25',
  telemetry:  'bg-cyan-electric/10 text-cyan-electric border-cyan-electric/25',
  action:     'bg-amber-warn/10 text-amber-warn border-amber-warn/25',
  transition: 'bg-green-neon/10 text-green-neon/80 border-green-neon/25',
}

function catKey(tool: ToolName) { return TOOL_CATEGORY[tool] }

function ToolPill({ item }: { item: Extract<ReturnType<typeof useOperatorStore['getState']>['transcript'][0], { kind: 'tool' }> }) {
  const [open, setOpen] = useState(false)
  const cat = catKey(item.tool)
  return (
    <div className="my-1">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[15px] font-mono transition-opacity hover:opacity-80',
          CAT_STYLES[cat],
        )}
      >
        {open ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
        <span>{item.tool}</span>
        {item.duration_ms != null && (
          <span className="opacity-60">{Math.round(item.duration_ms)}ms</span>
        )}
        {item.ok === false && <span className="text-red-400">✕</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1 ml-2 overflow-hidden"
          >
            <div className="border-l-2 border-border pl-3 py-1 space-y-1">
              {item.reason && (
                <p className="text-[15px] text-text-muted italic">"{item.reason}"</p>
              )}
              {item.result_preview && (
                <p className="text-[15px] font-mono text-text-muted">→ {item.result_preview}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AgentTranscript() {
  const transcript = useOperatorStore((s) => s.transcript)
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [transcript.length, autoScroll])

  return (
    <div className="panel panel-shadow flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-[15px] font-medium text-text-primary">Transcript</span>
        </div>
        <button
          onClick={() => setAutoScroll(v => !v)}
          className={cn(
            'text-[15px] px-2 py-0.5 rounded border transition-colors',
            autoScroll
              ? 'bg-cyan-electric/10 text-cyan-electric border-cyan-electric/25'
              : 'text-text-muted border-border hover:text-text-secondary'
          )}
        >
          {autoScroll ? 'Auto-scroll on' : 'Paused'}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1 min-h-0">
        {transcript.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted">
            <MessageSquare className="w-8 h-8 opacity-20" />
            <p className="text-[15px]">Waiting for call…</p>
          </div>
        )}

        {transcript.map((item) => {
          if (item.kind === 'tool') {
            return <ToolPill key={item.id} item={item as Parameters<typeof ToolPill>[0]['item']} />
          }

          const isAgent = item.role === 'agent'
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className={cn('flex', isAgent ? 'justify-start' : 'justify-end')}
            >
              <div className={cn(
                'max-w-[85%] rounded-xl px-3 py-2',
                isAgent
                  ? 'bg-bg-card border border-border rounded-tl-sm'
                  : 'bg-cyan-electric/10 border border-cyan-electric/20 rounded-tr-sm'
              )}>
                <p className={cn(
                  'text-[15px] font-medium mb-1',
                  isAgent ? 'text-text-muted' : 'text-cyan-electric/70'
                )}>
                  {isAgent ? 'Volt' : 'Caller'}
                </p>
                <p className="text-[15px] text-text-primary leading-relaxed">{item.text}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
