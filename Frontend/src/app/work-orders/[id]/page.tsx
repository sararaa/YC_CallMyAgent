'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, ClipboardList, Loader2, Mail, RefreshCw, X, Zap } from 'lucide-react'
import { EmailMessage, WorkOrder } from '@/lib/types'
import { WorkOrderTimeline } from '@/components/workorders/WorkOrderTimeline'
import { UsageGraph } from '@/components/charger/UsageGraph'
import { urgencyBg, statusBg, statusLabel, formatDate } from '@/lib/utils'
import { MOCK_CHARGERS, TECHNICIANS } from '@/lib/mockData'
import { Skeleton } from '@/components/ui/LoadingSkeleton'
import { useWorkOrderStore } from '@/store/workOrderStore'

// Map TECHNICIANS display names to emails for the demo
const TECH_EMAILS: Record<string, string> = {
  'Alex Rivera': 'sina@datapigeon.org',
  'Jordan Kim': 'sina@datapigeon.org',
  'Sam Patel': 'sina@datapigeon.org',
  'Taylor Wong': 'sina@datapigeon.org',
  'Morgan Chen': 'sina@datapigeon.org',
}

function EmailBubble({ msg }: { msg: EmailMessage }) {
  const isOutbound = msg.direction === 'outbound'
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
          isOutbound
            ? 'bg-slate-800 border-l-2 border-cyan-500'
            : 'bg-slate-900/60 border-l-2 border-violet-500'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${isOutbound ? 'text-cyan-400' : 'text-violet-400'}`}>
            {isOutbound ? 'Volt Dispatch' : 'Technician'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{msg.from}</span>
        </div>
        <p className="text-[11px] text-slate-500 mb-1 italic">{msg.subject}</p>
        <pre className="text-slate-300 whitespace-pre-wrap font-sans text-xs leading-relaxed">{msg.body}</pre>
        <p className="text-[10px] text-slate-600 mt-2 text-right font-mono">
          {new Date(msg.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [tech, setTech] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [localThread, setLocalThread] = useState<EmailMessage[]>([])

  // Live thread from WS
  const wsThread = useWorkOrderStore((s) => s.dispatchThreads[id.replace(/^wo-/, '')]) ?? []
  const wsStatus = useWorkOrderStore((s) => s.dispatchStatuses[id.replace(/^wo-/, '')])

  // Merge: local (from REST on load) + WS (live updates), deduplicated by timestamp+from
  const thread: EmailMessage[] = (() => {
    const seen = new Set(localThread.map((m) => `${m.timestamp}|${m.from}`))
    const extras = wsThread.filter((m) => !seen.has(`${m.timestamp}|${m.from}`))
    return [...localThread, ...extras]
  })()

  const effectiveStatus = (wsStatus ?? wo?.status) as WorkOrder['status'] | undefined

  useEffect(() => {
    fetch(`/api/workorders/${id}`)
      .then((r) => r.json())
      .then((data) => { setWo(data); setLoading(false) })
  }, [id])

  // Hydrate thread if WO is already dispatched
  useEffect(() => {
    if (!wo) return
    const alreadyDispatched = ['dispatched', 'in_progress', 'complete', 'resolved'].includes(wo.status)
    if (!alreadyDispatched) return
    fetch(`/api/workorders/${id}/dispatch`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.email_thread) setLocalThread(data.email_thread) })
  }, [id, wo])

  const charger = wo ? MOCK_CHARGERS.find((c) => c.id === wo.chargerId) : null
  const canDispatch = !!tech && wo?.status === 'open'
  const canCancel = !!wo && !['complete', 'resolved', 'cancelled'].includes((effectiveStatus ?? wo.status) as string)

  async function handleConfirm() {
    if (!wo) return
    setConfirming(true)
    try {
      const res = await fetch(`/api/workorders/${id}/confirm`, { method: 'POST' })
      if (res.ok) {
        setWo((prev) => prev ? { ...prev, status: 'in_progress' } : null)
      }
    } finally {
      setConfirming(false)
    }
  }

  async function handleReopen() {
    if (!wo) return
    setReopening(true)
    try {
      const res = await fetch(`/api/workorders/${id}/reopen`, { method: 'POST' })
      if (res.ok) {
        setWo((prev) => prev ? { ...prev, status: 'open' } : null)
      }
    } finally {
      setReopening(false)
    }
  }

  async function handleCancel() {
    if (!wo) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/workorders/${id}/cancel`, { method: 'POST' })
      if (res.ok) {
        setWo((prev) => prev ? { ...prev, status: 'cancelled' } : null)
      }
    } finally {
      setCancelling(false)
    }
  }

  async function handleDispatch() {
    if (!tech || !wo) return
    setDispatching(true)
    try {
      const res = await fetch(`/api/workorders/${id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianEmail: TECH_EMAILS[tech] ?? tech }),
      })
      if (res.ok) {
        const data = await res.json()
        setWo((prev) => prev ? { ...prev, status: 'dispatched', assignedTech: tech } : null)
        if (data.email_thread) setLocalThread(data.email_thread)
      }
    } finally {
      setDispatching(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!wo) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-600">
        <p>Work order not found</p>
      </div>
    )
  }

  const displayStatus = effectiveStatus ?? wo.status

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {/* Back */}
        <Link href="/work-orders" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Work Orders
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-electric/10 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-cyan-electric" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono text-white">{wo.woNumber}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{formatDate(wo.date)}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${urgencyBg(wo.urgency)}`}>{wo.urgency}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusBg(displayStatus)}`}>{statusLabel(displayStatus)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {displayStatus === 'dispatched' && (
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex items-center gap-2 bg-green-950/60 border border-green-500/30 text-green-400 font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-green-900/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {confirming ? 'Confirming…' : 'Confirm Accepted'}
              </button>
            )}
            {displayStatus === 'cancelled' && (
              <button
                onClick={handleReopen}
                disabled={reopening}
                className="flex items-center gap-2 bg-amber-950/60 border border-amber-500/30 text-amber-400 font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-amber-900/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {reopening ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {reopening ? 'Reopening…' : 'Reopen WO'}
              </button>
            )}
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-2 bg-red-950/60 border border-red-500/30 text-red-400 font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-red-900/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                {cancelling ? 'Cancelling…' : 'Cancel WO'}
              </button>
            )}
            <button
              onClick={handleDispatch}
              disabled={!canDispatch || dispatching}
              className="flex items-center gap-2 bg-cyan-electric text-bg-base font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-cyan-electric/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {dispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {dispatching ? 'Dispatching…' : 'Dispatch'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          {/* Left column */}
          <div className="space-y-4">
            {/* Summary */}
            <div className="glass rounded-xl p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Summary</p>
              <p className="text-sm text-slate-300 leading-relaxed">{wo.summary}</p>
            </div>

            {/* Key fields */}
            <div className="glass rounded-xl p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Details</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Customer', value: wo.customerName },
                  { label: 'Charger ID', value: wo.chargerId },
                  { label: 'Fault Code', value: wo.faultCode },
                  { label: 'Location', value: wo.location },
                  { label: 'Assigned Tech', value: wo.assignedTech || 'Unassigned' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</p>
                    <p className="text-sm text-slate-200 font-mono">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Parts */}
            {wo.parts.length > 0 && (
              <div className="glass rounded-xl p-5">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Parts</p>
                <div className="space-y-2">
                  {wo.parts.map((p) => (
                    <div key={p.partNumber} className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                      <div>
                        <p className="text-sm text-white">{p.name}</p>
                        <p className="text-xs font-mono text-slate-500">{p.partNumber}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {p.recommended && <span className="text-[10px] text-cyan-electric bg-cyan-950/50 px-2 py-0.5 rounded-full">Recommended</span>}
                        <span className="text-sm text-slate-400 font-mono">×{p.qty}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Technician */}
            <div className="glass rounded-xl p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Assign Technician</p>
              <select
                value={tech || wo.assignedTech || ''}
                onChange={(e) => setTech(e.target.value)}
                disabled={displayStatus !== 'open'}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-electric/50 disabled:opacity-50"
              >
                <option value="">Select technician...</option>
                {TECHNICIANS.map((t) => (
                  <option key={t} value={t} className="bg-slate-900">{t}</option>
                ))}
              </select>
              {displayStatus === 'open' && !tech && (
                <p className="text-[11px] text-slate-500 mt-2">Select a technician then click Dispatch.</p>
              )}
            </div>

            {/* Resolution */}
            {wo.resolutionSummary && (
              <div className="glass rounded-xl p-5 border border-green-neon/20">
                <p className="text-xs uppercase tracking-wider text-green-neon/70 mb-2">Resolution</p>
                <p className="text-sm text-slate-300 leading-relaxed">{wo.resolutionSummary}</p>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Timeline */}
            <div className="glass rounded-xl p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-4">Timeline</p>
              <WorkOrderTimeline events={wo.timeline} />
            </div>

            {/* Email thread */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-4 h-4 text-slate-400" />
                <p className="text-xs uppercase tracking-wider text-slate-500">Technician Email Thread</p>
                {thread.length > 0 && (
                  <span className="ml-auto text-[10px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                    {thread.length} msg{thread.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {thread.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-6">
                  No emails yet — select a technician and click Dispatch.
                </p>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {thread.map((msg, i) => (
                    <EmailBubble key={i} msg={msg} />
                  ))}
                </div>
              )}
            </div>

            {/* Usage graph */}
            {charger && (
              <div className="glass rounded-xl p-5">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Usage History — {wo.chargerId}</p>
                <UsageGraph data={charger.usageHistory} />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
