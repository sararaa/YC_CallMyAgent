'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { WorkOrder } from '@/lib/types'
import { urgencyColor, urgencyBg, statusBg, statusLabel, formatDate } from '@/lib/utils'
import { MapPin, ArrowRight } from 'lucide-react'

export function WorkOrderCard({ wo, index = 0 }: { wo: WorkOrder; index?: number }) {
  const color = urgencyColor(wo.urgency)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link href={`/work-orders/${wo.id}`}>
        <div
          className="panel p-4 cursor-pointer transition-colors hover:bg-bg-hover group"
          style={{ borderLeftColor: color, borderLeftWidth: '2px' }}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-[15px] font-mono text-cyan-electric">{wo.woNumber}</p>
              <p className="text-[15px] text-text-muted mt-0.5">{formatDate(wo.date)}</p>
            </div>
            <div className="flex gap-1">
              <span className={`text-[15px] px-1.5 py-0.5 rounded font-semibold ${urgencyBg(wo.urgency)}`}>{wo.urgency}</span>
              <span className={`text-[15px] px-1.5 py-0.5 rounded font-semibold ${statusBg(wo.status)}`}>{statusLabel(wo.status)}</span>
            </div>
          </div>

          <p className="text-[15px] font-semibold font-mono text-text-primary mb-1">{wo.chargerId}</p>
          <div className="flex items-center gap-1 text-[15px] text-text-muted mb-2">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{wo.location}</span>
          </div>
          {wo.faultCode !== '—' && (
            <p className="text-[15px] font-mono text-amber-warn/70 mb-3">{wo.faultCode}</p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[15px] text-text-muted">{wo.assignedTech || 'Unassigned'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
