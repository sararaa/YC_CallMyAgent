'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { WorkOrder } from '@/lib/types'
import { urgencyBg, statusBg, statusLabel, formatDate } from '@/lib/utils'
import { Eye } from 'lucide-react'

export function WorkOrderTable({ orders }: { orders: WorkOrder[] }) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {['WO #', 'Date', 'Charger', 'Location', 'Fault', 'Urgency', 'Status', 'Tech', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((wo, i) => (
            <motion.tr
              key={wo.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="border-b border-white/[0.04] hover:bg-white/5 transition-colors group cursor-pointer"
            >
              <td className="px-4 py-3 font-mono text-cyan-electric whitespace-nowrap">{wo.woNumber}</td>
              <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(wo.date)}</td>
              <td className="px-4 py-3 font-mono text-white whitespace-nowrap">{wo.chargerId}</td>
              <td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">{wo.location}</td>
              <td className="px-4 py-3 font-mono text-amber-400 whitespace-nowrap">{wo.faultCode}</td>
              <td className="px-4 py-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${urgencyBg(wo.urgency)}`}>{wo.urgency}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBg(wo.status)}`}>{statusLabel(wo.status)}</span>
              </td>
              <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{wo.assignedTech || '—'}</td>
              <td className="px-4 py-3">
                <Link
                  href={`/work-orders/${wo.id}`}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-electric transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </Link>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
