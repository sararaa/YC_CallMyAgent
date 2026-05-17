'use client'
import { useState, useEffect } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GeminiResult } from '@/lib/types'
import { FileText } from 'lucide-react'

export function DiagnosticCard({ result }: { result: GeminiResult }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    setDisplayed('')
    let i = 0
    const interval = setInterval(() => {
      if (i < result.diagnosticSummary.length) {
        setDisplayed(result.diagnosticSummary.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
      }
    }, 14)
    return () => clearInterval(interval)
  }, [result.diagnosticSummary])

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-violet-electric" />
        <p className="text-xs text-slate-500 uppercase tracking-wider">Diagnostic Summary</p>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">
        {displayed}
        {displayed.length < result.diagnosticSummary.length && (
          <span className="inline-block w-[2px] h-3.5 bg-violet-electric ml-0.5 animate-blink" />
        )}
      </p>
    </GlassCard>
  )
}
