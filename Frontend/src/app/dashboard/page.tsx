'use client'
import { motion } from 'framer-motion'
import { StateGraph } from '@/components/operator/StateGraph'
import { MemoryWall } from '@/components/operator/MemoryWall'
import { ToolPalette } from '@/components/operator/ToolPalette'
import { LatencyTicker } from '@/components/operator/LatencyTicker'
import { AgentDecisionPanel } from '@/components/operator/AgentDecisionPanel'
import { AgentTranscript } from '@/components/operator/AgentTranscript'
import { useOperatorStore } from '@/store/operatorStore'
import { useWsStatus } from '@/lib/wsBridge'
import { useEffect } from 'react'

/**
 * Operator view ("Volt"): the observability dashboard.
 * Reads from operatorStore which is populated by WsBridge (mounted in layout).
 *
 * Layout:
 *  - Top bar: LatencyTicker + WS status
 *  - Row 1: StateGraph (left, 7/12) | AgentTranscript + AgentDecisionPanel (right, 5/12)
 *  - Row 2: MemoryWall (left, 7/12) | ToolPalette (right, 5/12)
 */
export default function OperatorDashboard() {
  const currentState = useOperatorStore((s) => s.currentState)
  const wsStatus = useWsStatus((s) => s.status)

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tgt = e.target as HTMLElement | null
        if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return
        try {
          await fetch(
            (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000') + '/api/admin/reset',
            { method: 'POST' },
          )
        } catch { /* noop */ }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const wsDot =
    wsStatus === 'open' ? 'bg-green-neon' :
    wsStatus === 'connecting' ? 'bg-amber-warn' : 'bg-red-critical'

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Sub-top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-bg-panel">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10.5px]">
            <span className={`h-1.5 w-1.5 rounded-full ${wsDot}`} />
            <span className="text-slate-400 uppercase tracking-widest">WS · {wsStatus}</span>
          </div>
          <span className="text-slate-600">·</span>
          <div className="text-[11px]">
            <span className="text-slate-500">Stage:</span>{' '}
            <span className="text-white font-semibold">{currentState}</span>
          </div>
        </div>
        <LatencyTicker />
      </div>

      <div className="flex-1 grid grid-cols-12 grid-rows-2 gap-3 p-3 min-h-0">
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="col-span-7 row-span-1 min-h-0"
        >
          <StateGraph />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="col-span-5 row-span-1 flex flex-col gap-3 min-h-0"
        >
          <div className="flex-1 min-h-0"><AgentTranscript /></div>
          <AgentDecisionPanel />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="col-span-7 row-span-1 min-h-0"
        >
          <MemoryWall />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="col-span-5 row-span-1 min-h-0"
        >
          <ToolPalette />
        </motion.div>
      </div>
    </div>
  )
}
