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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/work-orders/${wo.id}`}>
        <div
          className="glass rounded-xl p-4 cursor-pointer transition-all duration-300 hover:-translate-y-1 group"
          style={{
            borderLeft: `3px solid ${color}`,
            boxShadow: `0 0 0 0 ${color}00`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${color}20, 0 4px 24px rgba(0,0,0,0.4)`
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 0 ${color}00`
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-xs font-mono text-cyan-electric">{wo.woNumber}</p>
              <p className="text-[10px] text-slate-500">{formatDate(wo.date)}</p>
            </div>
            <div className="flex gap-1.5">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${urgencyBg(wo.urgency)}`}>{wo.urgency}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBg(wo.status)}`}>{statusLabel(wo.status)}</span>
            </div>
          </div>

          <p className="text-base font-bold text-white font-mono mb-1">{wo.chargerId}</p>
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{wo.location}</span>
          </div>

          <p className="text-xs font-mono text-amber-400 mb-3">{wo.faultCode}</p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{wo.assignedTech || 'Unassigned'}</span>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-electric transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
