'use client'
import { Search, LayoutGrid, List, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WOStatus } from '@/lib/types'

const STATUSES: { label: string; value: 'all' | WOStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Complete', value: 'complete' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Cancelled', value: 'cancelled' },
]

interface Props {
  search: string
  onSearch: (v: string) => void
  status: string
  onStatus: (v: string) => void
  sort: string
  onSort: (v: string) => void
  view: 'table' | 'grid'
  onView: (v: 'table' | 'grid') => void
}

export function FilterBar({ search, onSearch, status, onStatus, sort, onSort, view, onView }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex-1 min-w-48">
        <Search className="w-4 h-4 text-slate-500 shrink-0" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search WO#, charger, fault..."
          className="bg-transparent text-sm text-slate-200 placeholder:text-slate-600 flex-1 outline-none"
        />
      </div>

      {/* Status chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => onStatus(s.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              status === s.value
                ? 'bg-cyan-electric text-bg-base font-semibold'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/10'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Sort */}
      <select
        value={sort}
        onChange={(e) => onSort(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none"
      >
        <option value="newest" className="bg-slate-900">Newest</option>
        <option value="oldest" className="bg-slate-900">Oldest</option>
        <option value="urgency" className="bg-slate-900">Urgency</option>
      </select>

      {/* View toggle */}
      <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-1">
        <button
          onClick={() => onView('table')}
          className={cn('p-1.5 rounded-lg transition-colors', view === 'table' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300')}
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => onView('grid')}
          className={cn('p-1.5 rounded-lg transition-colors', view === 'grid' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300')}
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>

      {/* Export */}
      <button
        onClick={() => console.log('Export CSV')}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
      </button>
    </div>
  )
}
