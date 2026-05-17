import { NextRequest, NextResponse } from 'next/server'
import { MOCK_CHARGERS } from '@/lib/mockData'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const charger = MOCK_CHARGERS.find((c) => c.id === id)
  if (!charger) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(charger)
}
