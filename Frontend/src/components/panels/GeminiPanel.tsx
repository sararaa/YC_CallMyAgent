'use client'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useGeminiStore } from '@/store/geminiStore'
import { ThinkingBlock } from '@/components/gemini/ThinkingBlock'
import { FaultCard } from '@/components/gemini/FaultCard'
import { UrgencyCard } from '@/components/gemini/UrgencyCard'
import { PartsCard } from '@/components/gemini/PartsCard'
import { DiagnosticCard } from '@/components/gemini/DiagnosticCard'
import { Bot } from 'lucide-react'

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  }),
}

export function GeminiPanel() {
  const { isThinking, isComplete, results } = useGeminiStore()

  return (
    <div className="glass rounded-xl panel-shadow flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-electric/20 to-violet-electric/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-cyan-electric" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Gemini Analysis</p>
          <p className="text-[10px] text-slate-500">Flash 2.0 · Real-time</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!isThinking && !isComplete && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <Bot className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-sm text-slate-600">Waiting for call to begin analysis...</p>
          </div>
        )}

        <ThinkingBlock />

        <AnimatePresence>
          {isComplete && results && (
            <>
              {[
                <FaultCard key="fault" result={results} />,
                <UrgencyCard key="urgency" result={results} />,
                <PartsCard key="parts" result={results} />,
                <DiagnosticCard key="diagnostic" result={results} />,
              ].map((card, i) => (
                <motion.div key={i} custom={i} initial="hidden" animate="visible" variants={cardVariants}>
                  {card}
                </motion.div>
              ))}
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
