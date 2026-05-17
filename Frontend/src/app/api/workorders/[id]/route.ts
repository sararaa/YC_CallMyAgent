import { NextRequest, NextResponse } from 'next/server'
import { MOCK_WORK_ORDERS } from '@/lib/mockData'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const wo = MOCK_WORK_ORDERS.find((w) => w.id === id)
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(wo)
}
