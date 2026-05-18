import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { FaultSeverity, StockStatus, Urgency, WOStatus } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function urgencyColor(urgency: Urgency): string {
  switch (urgency) {
    case 'P1': return '#ef4444'
    case 'P2': return '#f59e0b'
    case 'P3': return '#6366f1'
    case 'P4': return '#52525b'
  }
}

export function urgencyBg(urgency: Urgency): string {
  switch (urgency) {
    case 'P1': return 'bg-red-950/60 text-red-400 border border-red-900/50'
    case 'P2': return 'bg-amber-950/60 text-amber-400 border border-amber-900/50'
    case 'P3': return 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/50'
    case 'P4': return 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50'
  }
}

export function statusBg(status: WOStatus): string {
  switch (status) {
    case 'open':       return 'bg-blue-950/60 text-blue-400 border border-blue-900/50'
    case 'dispatched': return 'bg-violet-950/60 text-violet-400 border border-violet-900/50'
    case 'resolved':   return 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/50'
    case 'on_hold':    return 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50'
  }
}

export function statusLabel(status: WOStatus): string {
  switch (status) {
    case 'open':       return 'Open'
    case 'dispatched': return 'Dispatched'
    case 'resolved':   return 'Resolved'
    case 'on_hold':    return 'On Hold'
  }
}

export function severityColor(severity: FaultSeverity): string {
  switch (severity) {
    case 'critical': return '#ef4444'
    case 'warning':  return '#f59e0b'
    case 'info':     return '#6366f1'
  }
}

export function stockColor(stock: StockStatus): string {
  switch (stock) {
    case 'in_stock':       return '#22c55e'
    case 'low_stock':      return '#f59e0b'
    case 'order_required': return '#ef4444'
  }
}

export function stockLabel(stock: StockStatus): string {
  switch (stock) {
    case 'in_stock':       return 'In Stock'
    case 'low_stock':      return 'Low Stock'
    case 'order_required': return 'Order Required'
  }
}

export function healthColor(score: number): string {
  if (score > 80) return '#22c55e'
  if (score > 50) return '#f59e0b'
  return '#ef4444'
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
