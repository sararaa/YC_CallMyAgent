'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, ClipboardList, SendHorizonal } from 'lucide-react'
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
                <span className={`text-[15px] px-1.5 py-0.5 rounded font-semibold ${statusBg(wo.status)}`}>{statusLabel(wo.status)}</span>
              </div>
            </div>
          </div>
          <button className="flex items-center gap-1.5 bg-cyan-electric/15 text-cyan-electric border border-cyan-electric/30 font-medium px-3 py-1.5 rounded-md text-[15px] hover:bg-cyan-electric/25 transition-colors">
            <SendHorizonal className="w-3.5 h-3.5" />
            Dispatch
          </button>
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
                className="w-full bg-bg-base border border-border rounded-md px-3 py-2 text-[15px] text-text-primary outline-none focus:border-cyan-electric/40 transition-colors"
              >
                <option value="">Select technician…</option>
                {TECHNICIANS.map((t) => (
                  <option key={t} value={t} className="bg-bg-card">{t}</option>
                ))}
              </select>
            </Section>

            {wo.resolutionSummary && (
              <div className="panel p-4 border-l-2 border-green-neon/50">
                <p className="text-[15px] text-green-neon/70 mb-1.5">Resolution</p>
                <p className="text-[15px] text-text-secondary leading-relaxed">{wo.resolutionSummary}</p>
              </div>
            )}
          </div>

          {/* Right */}
          <div>
            <Section title="Timeline">
              <WorkOrderTimeline events={wo.timeline} />
            </Section>
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
