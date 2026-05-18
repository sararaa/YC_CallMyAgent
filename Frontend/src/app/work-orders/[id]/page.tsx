'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, ClipboardList, Zap } from 'lucide-react'
import { WorkOrder } from '@/lib/types'
import { WorkOrderTimeline } from '@/components/workorders/WorkOrderTimeline'
import { urgencyBg, statusBg, statusLabel, formatDate } from '@/lib/utils'
import { Skeleton } from '@/components/ui/LoadingSkeleton'

const TECHNICIANS = ['Alex Rivera', 'Jordan Kim', 'Sam Patel', 'Taylor Wong', 'Morgan Chen']

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [tech, setTech] = useState('')

  useEffect(() => {
    fetch(`/api/workorders/${id}`)
      .then((r) => r.json())
      .then((data) => { setWo(data); setLoading(false) })
  }, [id])

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
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusBg(wo.status)}`}>{statusLabel(wo.status)}</span>
              </div>
            </div>
          </div>

          <button className="flex items-center gap-2 bg-cyan-electric text-bg-base font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-cyan-electric/90 transition-all">
            <Zap className="w-4 h-4" />
            Dispatch
          </button>
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

            {/* Telemetry + KB context — populated server-side from Moss volt-kb */}
            {(wo as unknown as { details?: string }).details && (
              <div className="glass rounded-xl p-5">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">
                  Telemetry &amp; Knowledge Base Context
                </p>
                <pre className="text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
{(wo as unknown as { details: string }).details}
                </pre>
              </div>
            )}

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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-electric/50"
              >
                <option value="">Select technician...</option>
                {TECHNICIANS.map((t) => (
                  <option key={t} value={t} className="bg-slate-900">{t}</option>
                ))}
              </select>
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
          </div>
        </div>
      </motion.div>
    </div>
  )
}
