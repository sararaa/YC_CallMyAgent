'use client'
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCallStore } from '@/store/callStore'
import { TranscriptMessage } from '@/lib/types'

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="glass-light rounded-2xl rounded-tl-sm px-4 py-2.5 flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  )
}

function CallerBubble({ msg }: { msg: TranscriptMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex justify-end mb-3"
    >
      <div className="max-w-[85%] bg-violet-electric/80 rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-lg">
        <p className="text-sm text-white leading-relaxed">{msg.text}</p>
        {msg.isStreaming && (
          <span className="inline-block w-[2px] h-3 bg-white/60 ml-0.5 animate-blink" />
        )}
      </div>
    </motion.div>
  )
}

function SystemPill({ msg }: { msg: TranscriptMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex justify-center mb-4"
    >
      <span className="text-xs text-slate-500 bg-white/5 rounded-full px-3 py-1 border border-white/[0.06]">
        {msg.text}
      </span>
    </motion.div>
  )
}

export function Transcript() {
  const { transcript, status } = useCallStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const isStreaming = transcript.some((m) => m.isStreaming)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  if (transcript.length === 0 && status === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
        <p>Waiting for call...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <AnimatePresence initial={false}>
        {transcript.map((msg) =>
          msg.role === 'caller' ? (
            <CallerBubble key={msg.id} msg={msg} />
          ) : (
            <SystemPill key={msg.id} msg={msg} />
          )
        )}
      </AnimatePresence>

      {status === 'active' && !isStreaming && transcript.length > 0 && (
        <TypingIndicator />
      )}

      <div ref={bottomRef} />
    </div>
  )
}
