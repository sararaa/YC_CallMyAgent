'use client'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { GeminiResult } from '@/lib/types'
import { severityColor } from '@/lib/utils'

function RadialProgress({ value, color }: { value: number; color: string }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - value / 100)
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#ffffff10" strokeWidth="5" />
        <motion.circle
          cx="32" cy="32" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-sm font-bold font-mono" style={{ color }}>
        {value}%
      </span>
    </div>
  )
}

export function FaultCard({ result }: { result: GeminiResult }) {
  const sevColor = severityColor(result.severity)
  const variant = result.severity === 'critical' ? 'red' : result.severity === 'warning' ? 'amber' : 'cyan'

  return (
    <GlassCard className="border-l-2" style={{ borderLeftColor: sevColor } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Fault Detection</p>
          <p className="text-lg font-bold font-mono text-white">{result.faultCode}</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{result.faultDescription}</p>
        </div>
        <RadialProgress value={result.confidence} color="#00d4ff" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Confidence</span>
        <Badge variant={variant}>{result.severity}</Badge>
      </div>
    </GlassCard>
  )
}
