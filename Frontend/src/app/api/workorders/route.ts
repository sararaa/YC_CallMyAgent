import { NextRequest, NextResponse } from 'next/server'
import { MOCK_WORK_ORDERS } from '@/lib/mockData'
import { WOStatus } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const search = searchParams.get('search')?.toLowerCase() || ''
  const status = searchParams.get('status') || 'all'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const sort = searchParams.get('sort') || 'newest'

  let orders = [...MOCK_WORK_ORDERS]

  if (search) {
    orders = orders.filter(
      (wo) =>
        wo.woNumber.toLowerCase().includes(search) ||
        wo.chargerId.toLowerCase().includes(search) ||
        wo.customerName.toLowerCase().includes(search) ||
        wo.faultCode.toLowerCase().includes(search)
    )
  }

  if (status !== 'all') {
    orders = orders.filter((wo) => wo.status === (status as WOStatus))
  }

  orders.sort((a, b) => {
    if (sort === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime()
    if (sort === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime()
    const urgencyOrder = { P1: 0, P2: 1, P3: 2, P4: 3 }
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
  })

  const total = orders.length
  const paginated = orders.slice((page - 1) * limit, page * limit)

  return NextResponse.json({ orders: paginated, total, page, limit })
}
