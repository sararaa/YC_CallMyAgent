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
    <div className="p-5 max-w-screen-xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <div className="flex items-center gap-2.5 mb-0.5">
          <ClipboardList className="w-4.5 h-4.5 text-text-muted" />
          <h1 className="text-[20px] font-semibold text-text-primary">Work Orders</h1>
          <span className="text-[15px] text-text-muted ml-1">{orders.length} total</span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-4">
        <FilterBar
          search={search} onSearch={setSearch}
          status={status} onStatus={setStatus}
          sort={sort} onSort={setSort}
          view={view} onView={setView}
        />
      </motion.div>

      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 rounded-md bg-bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-24 text-text-muted">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-[15px]">No work orders match your filters</p>
        </div>
      ) : view === 'table' ? (
        <WorkOrderTable orders={orders} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {orders.map((wo, i) => (
            <WorkOrderCard key={wo.id} wo={wo} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
