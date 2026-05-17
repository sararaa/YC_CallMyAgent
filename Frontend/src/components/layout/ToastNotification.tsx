'use client'
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardCheck, X } from 'lucide-react'
import { useWorkOrderStore } from '@/store/workOrderStore'

export function ToastNotification() {
  const { showToast, currentWO, dismissToast, openModal } = useWorkOrderStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (showToast) {
      timerRef.current = setTimeout(() => dismissToast(), 10000)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [showToast, dismissToast])

  const handleClick = () => {
    dismissToast()
    openModal()
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {showToast && currentWO && (
          <motion.div
            initial={{ x: 120, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative w-80 rounded-xl overflow-hidden cursor-pointer"
            style={{
              background: 'rgba(15, 15, 30, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderLeft: '4px solid #00d4ff',
              boxShadow: '-4px 0 20px rgba(0,212,255,0.3), 0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={handleClick}
          >
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-electric/15 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-4 h-4 text-cyan-electric" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Work order generated</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {currentWO.chargerId} · {currentWO.woNumber} · Tap to view
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); dismissToast() }}
                  className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-[2px] bg-white/10">
              <motion.div
                className="h-full bg-cyan-electric"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 10, ease: 'linear' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
