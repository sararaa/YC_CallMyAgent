'use client'
import { useState } from 'react'
import { Mic, Send } from 'lucide-react'
import { useCallStore } from '@/store/callStore'

export function InputArea() {
  const { status } = useCallStore()
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  if (status !== 'ended') {
    return (
      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/[0.06]">
          <Mic className="w-4 h-4 text-slate-600" />
          <span className="text-sm text-slate-600 italic">Transcription Active...</span>
        </div>
      </div>
    )
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setNotes('')
  }

  return (
    <div className="p-4 border-t border-white/[0.06]">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes to this work order..."
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:border-cyan-electric/50 transition-colors"
        rows={3}
      />
      <button
        onClick={handleSave}
        disabled={!notes.trim()}
        className="mt-2 w-full flex items-center justify-center gap-2 bg-cyan-electric text-bg-base font-semibold py-2.5 rounded-xl text-sm hover:bg-cyan-electric/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <Send className="w-4 h-4" />
        {saved ? 'Saved!' : 'Save to Work Order'}
      </button>
    </div>
  )
}
