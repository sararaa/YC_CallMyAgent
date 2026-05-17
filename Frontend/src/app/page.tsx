'use client'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { GeminiPanel } from '@/components/panels/GeminiPanel'
import { CallPanel } from '@/components/panels/CallPanel'
import { ChargerPanel } from '@/components/panels/ChargerPanel'
import { useCallStore } from '@/store/callStore'
import { useChargerStore } from '@/store/chargerStore'
import { Brain, MessageSquare, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'gemini' | 'call' | 'charger'

/**
 * Root view ("ChargePulse"): 3-panel live call dashboard.
 *
 * Data flow: this page kicks off a scripted demo call via /api/call/start
 * (which forwards to the Python backend's /simulate endpoint). All subsequent
 * state — transcript, Gemini fault analysis, work order — arrives over the
 * dashboard WebSocket and is fanned into the relevant Zustand stores by the
 * <WsBridge /> mounted in layout.tsx. This page just consumes the stores.
 */
export default function Dashboard() {
  const { tickDuration, status, chargerId } = useCallStore()
  const { setActiveCharger, activeCharger } = useChargerStore()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('call')
  const started = useRef(false)

  // Trigger the demo call once on mount.
  useEffect(() => {
    if (started.current) return
    started.current = true
    fetch('/api/call/start', { method: 'POST' }).catch((e) =>
      console.error('failed to start demo call', e)
    )
  }, [])

  // Once the agent pulls telemetry, WsBridge updates callStore.chargerId.
  // Fetch the synthesized charger record from Python and populate the right panel.
  useEffect(() => {
    if (!chargerId || chargerId === '—' || chargerId.startsWith('pending')) return
    if (activeCharger && activeCharger.id === chargerId.toLowerCase()) return
    fetch(`/api/charger/${chargerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && !data.error) setActiveCharger(data) })
      .catch(() => { /* ignore */ })
  }, [chargerId, activeCharger, setActiveCharger])

  // Local duration ticker while the call is active. The Python backend
  // doesn't push per-second events — this is purely UI.
  useEffect(() => {
    if (status === 'active' && !timerRef.current) {
      timerRef.current = setInterval(() => tickDuration(), 1000)
    }
    if (status !== 'active' && timerRef.current) {
      clearInterval(timerRef.current); timerRef.current = null
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
  }, [status, tickDuration])

  const TABS = [
    { id: 'gemini' as Tab, label: 'Analysis', Icon: Brain },
    { id: 'call' as Tab, label: 'Call', Icon: MessageSquare },
    { id: 'charger' as Tab, label: 'Charger', Icon: Cpu },
  ]

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:grid lg:grid-cols-[340px_1fr_340px] gap-3 h-[calc(100vh-56px)] p-3">
        {[GeminiPanel, CallPanel, ChargerPanel].map((Panel, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }} className="min-h-0">
            <Panel />
          </motion.div>
        ))}
      </div>

      {/* Mobile */}
      <div className="lg:hidden flex flex-col h-[calc(100vh-56px)]">
        <div className="flex border-b border-white/[0.06] bg-bg-panel shrink-0">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
                activeTab === id ? 'text-cyan-electric border-b-2 border-cyan-electric -mb-[1px]' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 p-3 min-h-0">
          {activeTab === 'gemini' && <GeminiPanel />}
          {activeTab === 'call' && <CallPanel />}
          {activeTab === 'charger' && <ChargerPanel />}
        </div>
      </div>
    </>
  )
}
