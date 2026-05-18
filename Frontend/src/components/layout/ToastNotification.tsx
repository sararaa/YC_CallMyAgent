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

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <AnimatePresence>
        {showToast && currentWO && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-72 rounded-lg overflow-hidden cursor-pointer bg-bg-card border border-border shadow-xl"
            style={{ borderLeftColor: '#6366f1', borderLeftWidth: '3px' }}
            onClick={() => { dismissToast(); openModal() }}
          >
            <div className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-cyan-electric/15 flex items-center justify-center shrink-0 mt-0.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-cyan-electric" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-text-primary">Work order created</p>
                  <p className="text-[15px] text-text-muted mt-0.5 truncate">
                    {currentWO.chargerId} · {currentWO.woNumber}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); dismissToast() }}
                  className="text-text-muted hover:text-text-secondary transition-colors mt-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="h-[2px] bg-border">
              <motion.div
                className="h-full bg-cyan-electric/60"
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
