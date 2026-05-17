'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { StateGraph } from '@/components/operator/StateGraph'
import { MemoryWall } from '@/components/operator/MemoryWall'
import { LatencyTicker } from '@/components/operator/LatencyTicker'
import { AgentDecisionPanel } from '@/components/operator/AgentDecisionPanel'
import { AgentTranscript } from '@/components/operator/AgentTranscript'
import { useOperatorStore } from '@/store/operatorStore'
import { useCallStore } from '@/store/callStore'
import { useWsStatus } from '@/lib/wsBridge'
import { PhoneOff, RotateCcw } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

/**
 * Operator dashboard — the only view. No call page, no demo trigger.
 * Real calls arrive via AgentPhone webhook → Python backend → WebSocket → this page.
 *
 * Layout:
 *  - Sub-top bar: WS status · stage · latency · End Call · Reset
 *  - Row 1 (60%): StateGraph (col-7) | AgentTranscript + AgentDecisionPanel (col-5)
 *  - Row 2 (40%): MemoryWall full width
 */
export default function Operator() {
  const currentState = useOperatorStore((s) => s.currentState)
  const callActive = useOperatorStore((s) => s.callActive)
  const status = useCallStore((s) => s.status)
  const tickDuration = useCallStore((s) => s.tickDuration)
  const wsStatus = useWsStatus((s) => s.status)

  // Local duration ticker while a real call is in progress (cosmetic — Python is authoritative on actual duration)
  useEffect(() => {
    if (status !== 'active') return
    const id = setInterval(() => tickDuration(), 1000)
    return () => clearInterval(id)
  }, [status, tickDuration])

  // Hotkeys: R = reset, E = end call
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'r' || e.key === 'R') {
        try { await fetch(`${BACKEND}/api/admin/reset`, { method: 'POST' }) } catch { /* noop */ }
      } else if (e.key === 'e' || e.key === 'E') {
        try { await fetch(`${BACKEND}/api/admin/end_call`, { method: 'POST' }) } catch { /* noop */ }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const wsDot =
    wsStatus === 'open' ? 'bg-green-neon' :
    wsStatus === 'connecting' ? 'bg-amber-warn' : 'bg-red-critical'

  const endCall = async () => {
    try { await fetch(`${BACKEND}/api/admin/end_call`, { method: 'POST' }) } catch { /* noop */ }
  }
  const reset = async () => {
    try { await fetch(`${BACKEND}/api/admin/reset`, { method: 'POST' }) } catch { /* noop */ }
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Sub-top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-bg-panel shrink-0">
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
        <div className="flex items-center gap-3">
          <LatencyTicker />
          <div className="h-4 w-px bg-white/[0.08]" />
          <button
            onClick={endCall}
            disabled={!callActive}
            title="End the active call (E)"
            className="inline-flex items-center gap-1.5 text-[11px] text-red-300 hover:text-white border border-red-500/30 hover:border-red-500/60 rounded-md px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-red-300 disabled:hover:border-red-500/30 transition-colors"
          >
            <PhoneOff className="w-3 h-3" />
            End Call
          </button>
          <button
            onClick={reset}
            title="Reset everything (R)"
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white border border-white/[0.08] hover:border-white/20 rounded-md px-2.5 py-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Main grid: 60/40 split top to bottom */}
      <div className="flex-1 grid grid-cols-12 gap-3 p-3 min-h-0" style={{ gridTemplateRows: '3fr 2fr' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="col-span-7 min-h-0"
        >
          <StateGraph />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="col-span-5 flex flex-col gap-3 min-h-0"
        >
          <div className="flex-1 min-h-0"><AgentTranscript /></div>
          <AgentDecisionPanel />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="col-span-12 min-h-0"
        >
          <MemoryWall />
        </motion.div>
      </div>
    </div>
  )
}
