'use client'
import { GlassCard } from '@/components/ui/GlassCard'
import { GeminiResult } from '@/lib/types'
import { stockColor, stockLabel } from '@/lib/utils'
import { Package } from 'lucide-react'

export function PartsCard({ result }: { result: GeminiResult }) {
  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-4 h-4 text-cyan-electric" />
        <p className="text-xs text-slate-500 uppercase tracking-wider">Part Recommendations</p>
      </div>
      <div className="space-y-2">
        {result.parts.map((part) => (
          <div key={part.partNumber} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
            <div>
              <p className="text-sm text-white font-medium">{part.name}</p>
              <p className="text-xs font-mono text-slate-500">{part.partNumber}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: stockColor(part.stock) }}
              />
              <span className="text-xs text-slate-400">{stockLabel(part.stock)}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
