import { NextResponse } from 'next/server'
import { WorkOrder } from '@/lib/types'
import { SAMPLE_GEMINI_RESULT } from '@/lib/mockData'

export async function POST() {
  await new Promise((r) => setTimeout(r, 1500))

  const wo: WorkOrder = {
    id: 'wo-new-' + Date.now(),
    woNumber: 'WO-2024-0848',
    date: new Date().toISOString(),
    chargerId: 'CHG-4471',
    location: '550 Market St, San Francisco, CA 94104',
    customerName: 'Marcus Webb',
    faultCode: SAMPLE_GEMINI_RESULT.faultCode,
    urgency: SAMPLE_GEMINI_RESULT.urgency,
    status: 'open',
    assignedTech: null,
    summary: SAMPLE_GEMINI_RESULT.diagnosticSummary,
    parts: SAMPLE_GEMINI_RESULT.parts.map((p) => ({
      name: p.name,
      partNumber: p.partNumber,
      qty: 1,
      recommended: true,
    })),
    timeline: [
      { event: 'Work order created', timestamp: new Date().toISOString(), note: 'Auto-generated from call analysis' },
    ],
  }

  return NextResponse.json(wo)
}
