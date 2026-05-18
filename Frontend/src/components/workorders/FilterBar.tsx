'use client'
import { Search, LayoutGrid, List, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WOStatus } from '@/lib/types'

const STATUSES: { label: string; value: 'all' | WOStatus }[] = [
  { label: 'All',        value: 'all' },
  { label: 'Open',       value: 'open' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'Resolved',   value: 'resolved' },
  { label: 'On Hold',    value: 'on_hold' },
]

interface Props {
  search: string; onSearch: (v: string) => void
  status: string; onStatus: (v: string) => void
  sort: string;   onSort: (v: string) => void
  view: 'table' | 'grid'; onView: (v: 'table' | 'grid') => void
}

export function FilterBar({ search, onSearch, status, onStatus, sort, onSort, view, onView }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="flex items-center gap-2 bg-bg-card border border-border rounded-md px-3 py-1.5 flex-1 min-w-52">
        <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by WO#, charger, fault…"
          className="bg-transparent text-[15px] text-text-primary placeholder:text-text-muted flex-1 outline-none"
        />
      </div>

      {/* Status tabs */}
      <div className="flex items-center bg-bg-card border border-border rounded-md p-0.5">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => onStatus(s.value)}
            className={cn(
              'px-2.5 py-1 rounded text-[15px] font-medium transition-colors',
              status === s.value
                ? 'bg-bg-hover text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
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
        className="bg-bg-card border border-border rounded-md px-2.5 py-1.5 text-[15px] text-text-secondary outline-none cursor-pointer"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="urgency">By urgency</option>
      </select>

      {/* View toggle */}
      <div className="flex items-center bg-bg-card border border-border rounded-md p-0.5">
        <button
          onClick={() => onView('table')}
          className={cn('p-1.5 rounded transition-colors', view === 'table' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-secondary')}
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onView('grid')}
          className={cn('p-1.5 rounded transition-colors', view === 'grid' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-secondary')}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Export */}
      <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[15px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors">
        <Download className="w-3.5 h-3.5" />
        Export
      </button>
    </div>
  )
}
