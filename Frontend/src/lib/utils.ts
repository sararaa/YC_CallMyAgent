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
    case 'P3': return '#00d4ff'
    case 'P4': return '#6b7280'
  }
}

export function urgencyBg(urgency: Urgency): string {
  switch (urgency) {
    case 'P1': return 'bg-red-950/60 text-red-400 border border-red-500/30'
    case 'P2': return 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
    case 'P3': return 'bg-cyan-950/60 text-cyan-400 border border-cyan-500/30'
    case 'P4': return 'bg-gray-800/60 text-gray-400 border border-gray-600/30'
  }
}

export function statusBg(status: WOStatus): string {
  switch (status) {
    case 'open': return 'bg-blue-950/60 text-blue-400 border border-blue-500/30'
    case 'dispatched': return 'bg-violet-950/60 text-violet-400 border border-violet-500/30'
    case 'in_progress': return 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
    case 'complete': return 'bg-green-950/60 text-green-400 border border-green-500/30'
    case 'resolved': return 'bg-green-950/60 text-green-400 border border-green-500/30'
    case 'on_hold': return 'bg-gray-800/60 text-gray-400 border border-gray-600/30'
    case 'cancelled': return 'bg-red-950/60 text-red-400 border border-red-500/30'
  }
}

export function statusLabel(status: WOStatus): string {
  switch (status) {
    case 'open': return 'Open'
    case 'dispatched': return 'Dispatched'
    case 'in_progress': return 'In Progress'
    case 'complete': return 'Complete'
    case 'resolved': return 'Resolved'
    case 'on_hold': return 'On Hold'
    case 'cancelled': return 'Cancelled'
  }
}

export function severityColor(severity: FaultSeverity): string {
  switch (severity) {
    case 'critical': return '#ef4444'
    case 'warning': return '#f59e0b'
    case 'info': return '#00d4ff'
  }
}

export function stockColor(stock: StockStatus): string {
  switch (stock) {
    case 'in_stock': return '#00ff88'
    case 'low_stock': return '#f59e0b'
    case 'order_required': return '#ef4444'
  }
}

export function stockLabel(stock: StockStatus): string {
  switch (stock) {
    case 'in_stock': return 'In Stock'
    case 'low_stock': return 'Low Stock'
    case 'order_required': return 'Order Required'
  }
}

export function healthColor(score: number): string {
  if (score > 80) return '#00ff88'
  if (score > 50) return '#f59e0b'
  return '#ef4444'
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
