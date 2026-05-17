'use client'
import { Phone, PhoneOff } from 'lucide-react'
import { useCallStore } from '@/store/callStore'
import { CopyableId } from '@/components/ui/CopyableId'
import { formatDuration } from '@/lib/utils'
import { AudioWaveform } from './AudioWaveform'

export function CallHeader() {
  const { status, callerId, chargerId, duration } = useCallStore()

  return (
    <div className="p-4 border-b border-white/[0.06]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Phone className="w-4 h-4 text-cyan-electric" />
            <span className="text-sm font-semibold text-white">{callerId || '—'}</span>
          </div>
          {chargerId && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Charger</span>
              <CopyableId value={chargerId} className="text-sm" />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {status === 'active' && (
            <div className="flex items-center gap-1.5 bg-red-950/50 border border-red-500/30 rounded-full px-2.5 py-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-live" />
              <span className="text-red-400 text-xs font-bold tracking-wider">LIVE</span>
            </div>
          )}
          {status === 'ended' && (
            <div className="flex items-center gap-1.5 bg-slate-800 rounded-full px-2.5 py-1">
              <PhoneOff className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400 text-xs">Ended</span>
            </div>
          )}
          {(status === 'active' || status === 'ended') && (
            <span className="text-sm font-mono text-slate-400">{formatDuration(duration)}</span>
          )}
        </div>
      </div>

      <AudioWaveform />
    </div>
  )
}
