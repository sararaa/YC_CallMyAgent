import { create } from 'zustand'
import { GeminiResult } from '@/lib/types'

interface GeminiStore {
  isThinking: boolean
  thinkingText: string
  isComplete: boolean
  results: GeminiResult | null
  startThinking: () => void
  appendThinking: (text: string) => void
  setComplete: (results: GeminiResult) => void
  reset: () => void
}

export const useGeminiStore = create<GeminiStore>((set) => ({
  isThinking: false,
  thinkingText: '',
  isComplete: false,
  results: null,

  startThinking: () => set({ isThinking: true, thinkingText: '', isComplete: false, results: null }),

  appendThinking: (text) =>
    set((state) => ({ thinkingText: state.thinkingText + text })),

  setComplete: (results) => set({ isThinking: false, isComplete: true, results }),

  reset: () => set({ isThinking: false, thinkingText: '', isComplete: false, results: null }),
}))
