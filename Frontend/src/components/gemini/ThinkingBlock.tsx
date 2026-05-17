'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, ChevronDown, CheckCircle2, Brain } from 'lucide-react'
import { useGeminiStore } from '@/store/geminiStore'

export function ThinkingBlock() {
  const { isThinking, thinkingText, isComplete } = useGeminiStore()
  const [collapsed, setCollapsed] = useState(false)

  if (!isThinking && !isComplete) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl overflow-hidden border border-cyan-electric/20"
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
      >
        {isComplete ? (
          <CheckCircle2 className="w-4 h-4 text-green-neon shrink-0" />
        ) : (
          <Brain className="w-4 h-4 text-cyan-electric animate-spin-slow shrink-0" />
        )}
        <span className="text-sm font-medium text-slate-300 flex-1 text-left">
          {isComplete ? 'Analysis complete' : 'Gemini is analyzing...'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 max-h-48 overflow-y-auto">
              <p className="text-xs font-mono text-slate-400 leading-relaxed whitespace-pre-wrap">
                {thinkingText}
                {isThinking && (
                  <span className="inline-block w-[2px] h-3 bg-cyan-electric ml-0.5 animate-blink" />
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
