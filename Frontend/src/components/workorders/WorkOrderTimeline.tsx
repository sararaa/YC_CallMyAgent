'use client'
import { motion } from 'framer-motion'
import { WorkOrderTimelineEvent } from '@/lib/types'
import { Circle } from 'lucide-react'

export function WorkOrderTimeline({ events }: { events: WorkOrderTimelineEvent[] }) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-white/10" />
      <div className="space-y-5">
        {events.map((event, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative"
          >
            <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-bg-panel border-2 border-cyan-electric/60 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-electric" />
            </div>
            <div>
              <p className="text-sm text-white font-medium">{event.event}</p>
              <p className="text-[10px] font-mono text-slate-500 mt-0.5">{new Date(event.timestamp).toLocaleString()}</p>
              {event.note && (
                <p className="text-xs text-slate-400 mt-1 bg-white/5 rounded-lg px-2.5 py-1.5">{event.note}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
