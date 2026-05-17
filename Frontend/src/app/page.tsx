'use client'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { GeminiPanel } from '@/components/panels/GeminiPanel'
import { CallPanel } from '@/components/panels/CallPanel'
import { ChargerPanel } from '@/components/panels/ChargerPanel'
import { useCallStore } from '@/store/callStore'
import { useGeminiStore } from '@/store/geminiStore'
import { useChargerStore } from '@/store/chargerStore'
import { useWorkOrderStore } from '@/store/workOrderStore'
import { Brain, MessageSquare, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'gemini' | 'call' | 'charger'

export default function Dashboard() {
  const { startCall, endCall, addMessage, updateLastMessage, tickDuration } = useCallStore()
  const gemini = useGeminiStore()
  const { setActiveCharger } = useChargerStore()
  const { setCurrentWO, addWorkOrder, showToastNotification } = useWorkOrderStore()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('call')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function runDemo() {
      await new Promise((r) => setTimeout(r, 800))

      const callRes = await fetch('/api/call/start', { method: 'POST' })
      const callData = await callRes.json()
      startCall(callData.callId, callData.callerId, callData.chargerId)

      const chargerRes = await fetch(`/api/charger/${callData.chargerId}`)
      const chargerData = await chargerRes.json()
      setActiveCharger(chargerData)

      timerRef.current = setInterval(() => tickDuration(), 1000)

      addMessage({ id: 'sys-connect', role: 'system', text: `Call connected · ${callData.callerId} · ${callData.chargerId}`, timestamp: new Date() })

      // Stream transcript
      const es = new EventSource('/api/call/transcript')
      const messageMap = new Map<string, string>()

      await new Promise<void>((resolve) => {
        es.onmessage = (event) => {
          const data = JSON.parse(event.data)
          if (data.type === 'message_start') {
            messageMap.set(data.messageId, '')
            addMessage({ id: data.messageId, role: 'caller', text: '', timestamp: new Date(), isStreaming: true })
          } else if (data.type === 'word') {
            const current = (messageMap.get(data.messageId) || '') + data.word
            messageMap.set(data.messageId, current)
            updateLastMessage(data.messageId, current)
          } else if (data.type === 'call_ended') {
            es.close()
            resolve()
          }
        }
        es.onerror = () => { es.close(); resolve() }
      })

      endCall()
      if (timerRef.current) clearInterval(timerRef.current)
      addMessage({ id: 'sys-end', role: 'system', text: 'Call ended · Generating analysis...', timestamp: new Date() })

      // Gemini analysis
      await new Promise((r) => setTimeout(r, 600))
      gemini.startThinking()

      const geminiRes = await fetch('/api/gemini/analyze', { method: 'POST' })
      const reader = geminiRes.body!.getReader()
      const dec = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += dec.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const parsed = JSON.parse(line.slice(6))
          if (parsed.type === 'thinking_chunk') gemini.appendThinking(parsed.text)
          else if (parsed.type === 'result') gemini.setComplete(parsed.data)
        }
      }

      // Generate work order
      await new Promise((r) => setTimeout(r, 500))
      const woRes = await fetch('/api/workorder/generate', { method: 'POST' })
      const woData = await woRes.json()
      addWorkOrder(woData)
      setCurrentWO(woData)
      showToastNotification()
    }

    runDemo()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
