'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ClipboardList, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { useWorkOrderStore } from '@/store/workOrderStore'
import { TECHNICIANS } from '@/lib/mockData'
import { urgencyBg, statusBg, statusLabel, formatDate } from '@/lib/utils'

export function WorkOrderModal() {
  const { showModal, closeModal, currentWO } = useWorkOrderStore()
  const [expanded, setExpanded] = useState(false)
  const [tech, setTech] = useState('')

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [closeModal])

  useEffect(() => { if (!showModal) setExpanded(false) }, [showModal])

  if (!currentWO) return null

  return (
    <AnimatePresence>
      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="glass rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-white/[0.06]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-electric/10 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-cyan-electric" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white font-mono">{currentWO.woNumber}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${urgencyBg(currentWO.urgency)}`}>
                      {currentWO.urgency}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusBg(currentWO.status)}`}>
                      {statusLabel(currentWO.status)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Summary */}
              <p className="text-sm text-slate-300 leading-relaxed">{currentWO.summary}</p>

              {/* Key fields */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Customer', value: currentWO.customerName },
                  { label: 'Charger ID', value: currentWO.chargerId },
                  { label: 'Location', value: currentWO.location },
                  { label: 'Fault Code', value: currentWO.faultCode },
                  { label: 'Created', value: formatDate(currentWO.date) },
                  { label: 'Assigned Tech', value: currentWO.assignedTech || 'Unassigned' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</p>
                    <p className="text-sm text-slate-200 font-mono">{value}</p>
                  </div>
                ))}
              </div>

              {/* Expand button */}
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-sm text-cyan-electric hover:text-cyan-300 transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {expanded ? 'Hide Details' : 'View Full Details'}
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden space-y-4"
                  >
                    {/* Parts */}
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Recommended Parts</p>
                      <div className="space-y-2">
                        {currentWO.parts.map((p) => (
                          <div key={p.partNumber} className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                            <div>
                              <p className="text-sm text-white">{p.name}</p>
                              <p className="text-xs font-mono text-slate-500">{p.partNumber}</p>
                            </div>
                            <span className="text-sm text-slate-400">Qty: {p.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Technician */}
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Assign Technician</p>
                      <select
                        value={tech}
                        onChange={(e) => setTech(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-electric/50"
                      >
                        <option value="">Select technician...</option>
                        {TECHNICIANS.map((t) => (
                          <option key={t} value={t} className="bg-slate-900">{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Notes */}
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Notes</p>
                      <textarea
                        placeholder="Add dispatch notes..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:border-cyan-electric/50"
                        rows={3}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button className="flex-1 flex items-center justify-center gap-2 bg-cyan-electric text-bg-base font-bold py-2.5 rounded-xl text-sm hover:bg-cyan-electric/90 transition-all cyan-glow">
                  <Zap className="w-4 h-4" />
                  Dispatch Technician
                </button>
                <button className="px-4 py-2.5 rounded-xl text-sm text-slate-400 border border-white/10 hover:bg-white/5 transition-colors">
                  Hold
                </button>
                <button className="px-4 py-2.5 rounded-xl text-sm text-red-400 border border-red-500/20 hover:bg-red-950/30 transition-colors">
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
