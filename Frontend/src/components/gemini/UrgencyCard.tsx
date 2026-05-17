'use client'
import { GlassCard } from '@/components/ui/GlassCard'
import { GeminiResult } from '@/lib/types'
import { urgencyColor, urgencyBg } from '@/lib/utils'
import { Clock, AlertTriangle } from 'lucide-react'

export function UrgencyCard({ result }: { result: GeminiResult }) {
  const color = urgencyColor(result.urgency)
  return (
    <GlassCard>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Urgency Assessment</p>
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl font-mono"
          style={{ background: `${color}20`, color, boxShadow: `0 0 20px ${color}40` }}
        >
          {result.urgency}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{result.responseWindow}</p>
          <p className="text-xs text-slate-400 mt-0.5">Response window</p>
        </div>
      </div>
      <div className="flex items-start gap-2 bg-white/5 rounded-lg p-2.5">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-300">{result.downtimeRisk}</p>
      </div>
    </GlassCard>
  )
}
