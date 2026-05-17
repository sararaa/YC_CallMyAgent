'use client'
import { MessageSquare } from 'lucide-react'
import { CallHeader } from '@/components/call/CallHeader'
import { Transcript } from '@/components/call/Transcript'
import { InputArea } from '@/components/call/InputArea'

export function CallPanel() {
  return (
    <div className="glass rounded-xl panel-shadow flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-electric/20 to-violet-electric/10 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-violet-electric" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Live Call</p>
          <p className="text-[10px] text-slate-500">Transcription · AI-powered</p>
        </div>
      </div>

      <CallHeader />
      <Transcript />
      <InputArea />
    </div>
  )
}
