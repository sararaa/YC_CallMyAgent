'use client'
import dynamic from 'next/dynamic'
import { UsageDay } from '@/lib/types'

const Chart = dynamic(() => import('./UsageGraphInner').then(m => m.UsageGraphInner), {
  ssr: false,
  loading: () => <div className="h-44 rounded-xl bg-white/5 animate-pulse" />,
})

export function UsageGraph({ data }: { data: UsageDay[] }) {
  return <Chart data={data} />
}
