'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, ClipboardList, Loader2, Mail, RefreshCw, X, Zap } from 'lucide-react'
import { EmailMessage, WorkOrder } from '@/lib/types'
import { WorkOrderTimeline } from '@/components/workorders/WorkOrderTimeline'
import { urgencyBg, statusBg, statusLabel, formatDate } from '@/lib/utils'
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

const TECHNICIANS = ['Alex Rivera', 'Jordan Kim', 'Sam Patel', 'Taylor Wong', 'Morgan Chen']

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
      <div className="p-5 max-w-4xl mx-auto space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!wo) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <p className="text-[15px]">Work order not found</p>
      </div>
    )
  }

  const displayStatus = effectiveStatus ?? wo.status

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/work-orders" className="inline-flex items-center gap-1.5 text-[15px] text-text-muted hover:text-text-secondary mb-5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Work Orders
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-bg-card border border-border flex items-center justify-center">
              <ClipboardList className="w-4.5 h-4.5 text-text-muted" />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold font-mono text-text-primary">{wo.woNumber}</h1>
              <p className="text-[15px] text-text-muted mt-0.5">{formatDate(wo.date)}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`text-[15px] px-1.5 py-0.5 rounded font-semibold ${urgencyBg(wo.urgency)}`}>{wo.urgency}</span>
                <span className={`text-[15px] px-1.5 py-0.5 rounded font-semibold ${statusBg(displayStatus)}`}>{statusLabel(displayStatus)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {displayStatus === 'dispatched' && (
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-medium px-3 py-1.5 rounded-md text-[15px] hover:bg-emerald-900/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                {confirming ? 'Confirming…' : 'Confirm Accepted'}
              </button>
            )}
            {displayStatus === 'cancelled' && (
              <button
                onClick={handleReopen}
                disabled={reopening}
                className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/30 text-amber-400 font-medium px-3 py-1.5 rounded-md text-[15px] hover:bg-amber-900/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {reopening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {reopening ? 'Reopening…' : 'Reopen WO'}
              </button>
            )}
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-1.5 bg-red-950/60 border border-red-500/30 text-red-400 font-medium px-3 py-1.5 rounded-md text-[15px] hover:bg-red-900/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                {cancelling ? 'Cancelling…' : 'Cancel WO'}
              </button>
            )}
            <button
              onClick={handleDispatch}
              disabled={!canDispatch || dispatching}
              className="flex items-center gap-1.5 bg-cyan-electric/15 text-cyan-electric border border-cyan-electric/30 font-medium px-3 py-1.5 rounded-md text-[15px] hover:bg-cyan-electric/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {dispatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {dispatching ? 'Dispatching…' : 'Dispatch'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
          {/* Left */}
          <div className="space-y-3">
            <Section title="Summary">
              <p className="text-[15px] text-text-secondary leading-relaxed">{wo.summary}</p>
            </Section>

            <Section title="Details">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Customer',      value: wo.customerName },
                  { label: 'Charger ID',    value: wo.chargerId },
                  { label: 'Fault Code',    value: wo.faultCode },
                  { label: 'Location',      value: wo.location },
                  { label: 'Assigned Tech', value: wo.assignedTech || 'Unassigned' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-bg-base border border-border rounded-md p-2.5">
                    <p className="text-[15px] text-text-muted mb-0.5">{label}</p>
                    <p className="text-[15px] text-text-primary font-mono">{value}</p>
                  </div>
                ))}
              </div>
            </Section>

            {(wo as unknown as { details?: string }).details && (
              <Section title="Telemetry & knowledge context">
                <pre className="text-[15px] text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">
                  {(wo as unknown as { details: string }).details}
                </pre>
              </Section>
            )}

            {wo.parts.length > 0 && (
              <Section title="Parts">
                <div className="space-y-1.5">
                  {wo.parts.map((p) => (
                    <div key={p.partNumber} className="flex justify-between items-center bg-bg-base border border-border rounded-md p-2.5">
                      <div>
                        <p className="text-[15px] text-text-primary">{p.name}</p>
                        <p className="text-[15px] font-mono text-text-muted">{p.partNumber}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.recommended && (
                          <span className="text-[15px] text-cyan-electric bg-cyan-electric/10 border border-cyan-electric/20 px-1.5 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                        <span className="text-[15px] text-text-muted font-mono">×{p.qty}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Assign technician">
              <select
                value={tech || wo.assignedTech || ''}
                onChange={(e) => setTech(e.target.value)}
                disabled={displayStatus !== 'open'}
                className="w-full bg-bg-base border border-border rounded-md px-3 py-2 text-[15px] text-text-primary outline-none focus:border-cyan-electric/40 transition-colors disabled:opacity-50"
              >
                <option value="">Select technician…</option>
                {TECHNICIANS.map((t) => (
                  <option key={t} value={t} className="bg-bg-card">{t}</option>
                ))}
              </select>
              {displayStatus === 'open' && !tech && (
                <p className="text-[13px] text-text-muted mt-2">Select a technician then click Dispatch.</p>
              )}
            </Section>

            {wo.resolutionSummary && (
              <div className="panel p-4 border-l-2 border-green-neon/50">
                <p className="text-[15px] text-green-neon/70 mb-1.5">Resolution</p>
                <p className="text-[15px] text-text-secondary leading-relaxed">{wo.resolutionSummary}</p>
              </div>
            )}
          </div>

          {/* Right */}
          <div className="space-y-3">
            <Section title="Timeline">
              <WorkOrderTimeline events={wo.timeline} />
            </Section>

            {/* Email thread */}
            <div className="panel p-4">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-3.5 h-3.5 text-text-muted" />
                <p className="text-[15px] font-medium text-text-muted">Technician Email Thread</p>
                {thread.length > 0 && (
                  <span className="ml-auto text-[13px] text-text-muted font-mono">
                    {thread.length} msg{thread.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {thread.length === 0 ? (
                <p className="text-[15px] text-text-muted text-center py-4">
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
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <p className="text-[15px] font-medium text-text-muted mb-3">{title}</p>
      {children}
    </div>
  )
}
