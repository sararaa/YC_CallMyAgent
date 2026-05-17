export type CallStatus = 'idle' | 'active' | 'ended'
export type FaultSeverity = 'critical' | 'warning' | 'info'
export type Urgency = 'P1' | 'P2' | 'P3' | 'P4'
export type WOStatus = 'open' | 'dispatched' | 'resolved' | 'on_hold'
export type StockStatus = 'in_stock' | 'low_stock' | 'order_required'
export type ChargerStatus = 'online' | 'offline' | 'degraded'

export interface TranscriptMessage {
  id: string
  role: 'caller' | 'system'
  text: string
  timestamp: Date
  isStreaming?: boolean
}

export interface GeminiResult {
  faultCode: string
  faultDescription: string
  confidence: number
  severity: FaultSeverity
  urgency: Urgency
  downtimeRisk: string
  responseWindow: string
  parts: { name: string; partNumber: string; stock: StockStatus }[]
  diagnosticSummary: string
}

export interface UsageDay {
  date: string
  sessions: number
  kwh: number
  hasFault?: boolean
}

export interface WorkOrderPart {
  name: string
  partNumber: string
  qty: number
  recommended: boolean
}

export interface WorkOrderTimelineEvent {
  event: string
  timestamp: string
  note?: string
}

export interface WorkOrder {
  id: string
  woNumber: string
  date: string
  chargerId: string
  location: string
  customerName: string
  faultCode: string
  urgency: Urgency
  status: WOStatus
  assignedTech: string | null
  summary: string
  parts: WorkOrderPart[]
  timeline: WorkOrderTimelineEvent[]
  resolutionSummary?: string
}

export interface ChargerData {
  id: string
  location: string
  model: string
  installDate: string
  firmwareVersion: string
  lastServiced: string
  status: ChargerStatus
  healthScore: number
  usageHistory: UsageDay[]
  pastWorkOrders: WorkOrder[]
}
