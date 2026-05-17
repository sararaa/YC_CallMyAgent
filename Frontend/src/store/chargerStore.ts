import { create } from 'zustand'
import { ChargerData } from '@/lib/types'

interface ChargerStore {
  activeCharger: ChargerData | null
  setActiveCharger: (charger: ChargerData) => void
  reset: () => void
}

export const useChargerStore = create<ChargerStore>((set) => ({
  activeCharger: null,
  setActiveCharger: (charger) => set({ activeCharger: charger }),
  reset: () => set({ activeCharger: null }),
}))
