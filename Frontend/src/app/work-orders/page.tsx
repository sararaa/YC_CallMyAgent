'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FilterBar } from '@/components/workorders/FilterBar'
import { WorkOrderTable } from '@/components/workorders/WorkOrderTable'
import { WorkOrderCard } from '@/components/workorders/WorkOrderCard'
import { WorkOrder } from '@/lib/types'
import { ClipboardList } from 'lucide-react'

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('newest')
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ search, status, sort })
    fetch(`/api/workorders?${params}`)
      .then((r) => r.json())
      .then((data) => { setOrders(data.orders); setLoading(false) })
  }, [search, status, sort])

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardList className="w-6 h-6 text-cyan-electric" />
          <h1 className="text-2xl font-bold text-white">Work Orders</h1>
        </div>
        <p className="text-sm text-slate-500 ml-9">{orders.length} orders found</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4">
        <FilterBar
          search={search} onSearch={setSearch}
          status={status} onStatus={setStatus}
          sort={sort} onSort={setSort}
          view={view} onView={setView}
        />
      </motion.div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-24 text-slate-600">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No work orders match your filters</p>
        </div>
      ) : view === 'table' ? (
        <WorkOrderTable orders={orders} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {orders.map((wo, i) => (
            <WorkOrderCard key={wo.id} wo={wo} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
