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
import { PhoneOff, RotateCcw } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export default function Operator() {
  const currentState = useOperatorStore((s) => s.currentState)
  const status = useCallStore((s) => s.status)
  const tickDuration = useCallStore((s) => s.tickDuration)
  const callActive = useOperatorStore((s) => s.callActive)

  useEffect(() => {
    if (status !== 'active') return
    const id = setInterval(() => tickDuration(), 1000)
    return () => clearInterval(id)
  }, [status, tickDuration])

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

  const endCall = async () => {
    try { await fetch(`${BACKEND}/api/admin/end_call`, { method: 'POST' }) } catch { /* noop */ }
  }
  const reset = async () => {
    try { await fetch(`${BACKEND}/api/admin/reset`, { method: 'POST' }) } catch { /* noop */ }
  }

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col">
      {/* Control bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-base shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[15px] text-text-muted">Stage</span>
            <span className="text-[15px] font-medium text-text-primary bg-bg-card border border-border px-2 py-0.5 rounded-md">
              {currentState}
            </span>
          </div>
          <div className="w-px h-3 bg-border" />
          <LatencyTicker />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={endCall}
            disabled={!callActive}
            className="inline-flex items-center gap-1.5 text-[15px] text-text-muted hover:text-red-400 border border-border hover:border-red-900/60 rounded-md px-2.5 py-1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <PhoneOff className="w-3 h-3" />
            End call
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-[15px] text-text-muted hover:text-text-primary border border-border hover:border-border rounded-md px-2.5 py-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 gap-2 p-2 min-h-0" style={{ gridTemplateRows: '3fr 2fr' }}>
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="col-span-7 min-h-0"
        >
          <StateGraph />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="col-span-5 flex flex-col gap-2 min-h-0"
        >
          <div className="flex-1 min-h-0"><AgentTranscript /></div>
          <AgentDecisionPanel />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="col-span-12 min-h-0"
        >
          <MemoryWall />
        </motion.div>
      </div>
    </div>
  )
}
