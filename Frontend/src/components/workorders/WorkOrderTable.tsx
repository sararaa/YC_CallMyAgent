'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { WorkOrder } from '@/lib/types'
import { urgencyBg, statusBg, statusLabel, formatDate } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

const COLS = ['WO #', 'Date', 'Charger', 'Location', 'Fault', 'Priority', 'Status', 'Tech', '']

export function WorkOrderTable({ orders }: { orders: WorkOrder[] }) {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {COLS.map((h) => (
              <th key={h} className="text-left px-4 py-2.5 text-[15px] font-medium text-text-muted whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {orders.map((wo, i) => (
            <motion.tr
              key={wo.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="hover:bg-bg-hover transition-colors group"
            >
              <td className="px-4 py-2.5 font-mono text-[15px] text-cyan-electric whitespace-nowrap">{wo.woNumber}</td>
              <td className="px-4 py-2.5 text-[15px] text-text-muted whitespace-nowrap">{formatDate(wo.date)}</td>
              <td className="px-4 py-2.5 font-mono text-[15px] text-text-primary whitespace-nowrap">{wo.chargerId}</td>
              <td className="px-4 py-2.5 text-[15px] text-text-muted max-w-[160px] truncate">{wo.location}</td>
              <td className="px-4 py-2.5 font-mono text-[15px] text-amber-warn/80 whitespace-nowrap">{wo.faultCode}</td>
              <td className="px-4 py-2.5">
                <span className={`text-[15px] px-1.5 py-0.5 rounded font-semibold ${urgencyBg(wo.urgency)}`}>{wo.urgency}</span>
              </td>
              <td className="px-4 py-2.5">
                <span className={`text-[15px] px-1.5 py-0.5 rounded font-semibold ${statusBg(wo.status)}`}>{statusLabel(wo.status)}</span>
              </td>
              <td className="px-4 py-2.5 text-[15px] text-text-muted whitespace-nowrap">{wo.assignedTech || '—'}</td>
              <td className="px-4 py-2.5">
                <Link
                  href={`/work-orders/${wo.id}`}
                  className="flex items-center gap-1 text-[15px] text-text-muted hover:text-text-primary transition-colors group-hover:opacity-100 opacity-0"
                >
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
