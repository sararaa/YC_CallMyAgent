'use client'
import { ChargerData } from '@/lib/types'
import { StatusDot } from '@/components/ui/StatusDot'
import { CopyableId } from '@/components/ui/CopyableId'
import { MapPin } from 'lucide-react'

const LABEL = 'text-[10px] uppercase tracking-wider text-slate-500 font-medium'
const VALUE = 'text-sm text-slate-200 font-mono'

interface Props { charger: ChargerData }

export function ChargerInfoCard({ charger }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <CopyableId value={charger.id} className="text-lg font-bold" />
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
            <MapPin className="w-3 h-3" />
            <span className="leading-tight">{charger.location}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1 shrink-0">
          <StatusDot status={charger.status} />
          <span className="text-xs capitalize text-slate-300">{charger.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Model', value: charger.model },
          { label: 'Firmware', value: charger.firmwareVersion },
          { label: 'Install Date', value: charger.installDate },
          { label: 'Last Serviced', value: charger.lastServiced },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/5 rounded-lg p-2.5">
            <p className={LABEL}>{label}</p>
            <p className={VALUE}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
