import { create } from 'zustand'
import { CallStatus, TranscriptMessage } from '@/lib/types'

interface CallStore {
  status: CallStatus
  callId: string | null
  callerId: string | null
  chargerId: string | null
  duration: number
  transcript: TranscriptMessage[]
  startCall: (callId: string, callerId: string, chargerId: string) => void
  endCall: () => void
  addMessage: (msg: TranscriptMessage) => void
  updateLastMessage: (id: string, text: string) => void
  tickDuration: () => void
  reset: () => void
}

export const useCallStore = create<CallStore>((set) => ({
  status: 'idle',
  callId: null,
  callerId: null,
  chargerId: null,
  duration: 0,
  transcript: [],

  startCall: (callId, callerId, chargerId) =>
    set({ status: 'active', callId, callerId, chargerId, duration: 0, transcript: [] }),

  endCall: () => set({ status: 'ended' }),

  addMessage: (msg) =>
    set((state) => ({ transcript: [...state.transcript, msg] })),

  updateLastMessage: (id, text) =>
    set((state) => ({
      transcript: state.transcript.map((m) =>
        m.id === id ? { ...m, text, isStreaming: false } : m
      ),
    })),

  tickDuration: () => set((state) => ({ duration: state.duration + 1 })),

  reset: () => set({ status: 'idle', callId: null, callerId: null, chargerId: null, duration: 0, transcript: [] }),
}))
