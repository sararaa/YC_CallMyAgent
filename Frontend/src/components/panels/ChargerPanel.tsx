'use client'
import { Cpu } from 'lucide-react'
import { useChargerStore } from '@/store/chargerStore'
import { ChargerInfoCard } from '@/components/charger/ChargerInfoCard'
import { UsageGraph } from '@/components/charger/UsageGraph'
import { HealthScore } from '@/components/charger/HealthScore'
import { PastWorkOrders } from '@/components/charger/PastWorkOrders'
import { PanelSkeleton } from '@/components/ui/LoadingSkeleton'

export function ChargerPanel() {
  const { activeCharger } = useChargerStore()

  return (
    <div className="glass rounded-xl panel-shadow flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-neon/20 to-cyan-electric/10 flex items-center justify-center">
          <Cpu className="w-4 h-4 text-green-neon" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Charger Context</p>
          <p className="text-[10px] text-slate-500">Historical · Diagnostics</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {!activeCharger ? (
          <PanelSkeleton />
        ) : (
          <>
            <ChargerInfoCard charger={activeCharger} />

            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Usage (30 days)</p>
              <div className="glass-light rounded-xl p-3">
                <UsageGraph data={activeCharger.usageHistory} />
                <div className="flex gap-4 mt-2 justify-center">
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="w-3 h-[2px] bg-cyan-electric inline-block" />Sessions
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="w-3 h-[2px] bg-violet-electric inline-block" />kWh
                  </span>
                </div>
              </div>
            </div>

            <HealthScore score={activeCharger.healthScore} />

            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Past Work Orders</p>
              <PastWorkOrders orders={activeCharger.pastWorkOrders} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
