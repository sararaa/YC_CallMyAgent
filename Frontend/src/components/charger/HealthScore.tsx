'use client'
import { motion } from 'framer-motion'
import { healthColor } from '@/lib/utils'

export function HealthScore({ score }: { score: number }) {
  const color = healthColor(score)
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)

  return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Health Score</p>
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#ffffff08" strokeWidth="10" />
          <motion.circle
            cx="64" cy="64" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-black font-mono" style={{ color }}>{score}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">/ 100</span>
        </div>
      </div>
    </div>
  )
}
