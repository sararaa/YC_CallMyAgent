'use client'
import Link from 'next/link'
import { WorkOrder } from '@/lib/types'
import { statusBg, statusLabel, urgencyBg, formatDate } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

export function PastWorkOrders({ orders }: { orders: WorkOrder[] }) {
  if (!orders.length) {
    return <p className="text-xs text-slate-600 text-center py-4">No work orders for this charger</p>
  }

  return (
    <div className="space-y-2">
      {orders.slice(0, 5).map((wo) => (
        <Link
          key={wo.id}
          href={`/work-orders/${wo.id}`}
          className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-cyan-electric">{wo.woNumber}</span>
              <span className="text-[10px] text-slate-500">{formatDate(wo.date)}</span>
            </div>
            <p className="text-xs text-slate-400 truncate">{wo.faultCode} — {wo.summary.slice(0, 50)}...</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${statusBg(wo.status)}`}>
              {statusLabel(wo.status)}
            </span>
            <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </div>
        </Link>
      ))}
    </div>
  )
}
