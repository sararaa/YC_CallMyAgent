import { create } from 'zustand'
import { WorkOrder } from '@/lib/types'
import { MOCK_WORK_ORDERS } from '@/lib/mockData'

interface WorkOrderStore {
  currentWO: WorkOrder | null
  workOrders: WorkOrder[]
  showModal: boolean
  showToast: boolean
  setCurrentWO: (wo: WorkOrder) => void
  addWorkOrder: (wo: WorkOrder) => void
  openModal: () => void
  closeModal: () => void
  showToastNotification: () => void
  dismissToast: () => void
}

export const useWorkOrderStore = create<WorkOrderStore>((set) => ({
  currentWO: null,
  workOrders: MOCK_WORK_ORDERS,
  showModal: false,
  showToast: false,

  setCurrentWO: (wo) => set({ currentWO: wo }),
  addWorkOrder: (wo) => set((state) => ({ workOrders: [wo, ...state.workOrders] })),
  openModal: () => set({ showModal: true }),
  closeModal: () => set({ showModal: false }),
  showToastNotification: () => set({ showToast: true }),
  dismissToast: () => set({ showToast: false }),
}))
