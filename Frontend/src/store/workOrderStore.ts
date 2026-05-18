import { create } from 'zustand'
import { EmailMessage, WorkOrder } from '@/lib/types'

interface WorkOrderStore {
  currentWO: WorkOrder | null
  workOrders: WorkOrder[]
  showModal: boolean
  showToast: boolean
  // keyed by wo_id (number as string)
  dispatchThreads: Record<string, EmailMessage[]>
  dispatchStatuses: Record<string, string>
  setCurrentWO: (wo: WorkOrder) => void
  addWorkOrder: (wo: WorkOrder) => void
  openModal: () => void
  closeModal: () => void
  showToastNotification: () => void
  dismissToast: () => void
  appendEmailToThread: (woId: string, msg: EmailMessage) => void
  setDispatchStatus: (woId: string, status: string) => void
}

export const useWorkOrderStore = create<WorkOrderStore>((set) => ({
  currentWO: null,
  workOrders: [],
  showModal: false,
  showToast: false,
  dispatchThreads: {},
  dispatchStatuses: {},

  setCurrentWO: (wo) => set({ currentWO: wo }),
  addWorkOrder: (wo) => set((state) => ({ workOrders: [wo, ...state.workOrders] })),
  openModal: () => set({ showModal: true }),
  closeModal: () => set({ showModal: false }),
  showToastNotification: () => set({ showToast: true }),
  dismissToast: () => set({ showToast: false }),

  appendEmailToThread: (woId, msg) =>
    set((state) => ({
      dispatchThreads: {
        ...state.dispatchThreads,
        [woId]: [...(state.dispatchThreads[woId] ?? []), msg],
      },
    })),

  setDispatchStatus: (woId, status) =>
    set((state) => ({
      dispatchStatuses: { ...state.dispatchStatuses, [woId]: status },
    })),
}))
