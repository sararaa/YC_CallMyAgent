import { NextResponse } from 'next/server'

export async function POST() {
  await new Promise((r) => setTimeout(r, 400))
  return NextResponse.json({
    callId: 'call-' + Date.now(),
    callerId: 'Marcus Webb',
    chargerId: 'CHG-4471',
    callerPhone: '+1-415-555-0182',
  })
}
