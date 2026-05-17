'use client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { UsageDay } from '@/lib/types'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs space-y-1">
      <p className="text-slate-400 font-mono">{label}</p>
      <p className="text-cyan-electric">Sessions: {payload[0]?.value ?? 0}</p>
      <p className="text-violet-400">kWh: {payload[1]?.value ?? 0}</p>
    </div>
  )
}

export function UsageGraphInner({ data }: { data: UsageDay[] }) {
  const faultDates = data.filter((d) => d.hasFault).map((d) => d.date)
  const shortDates = data.map((d, i) => ({ ...d, label: i % 5 === 0 ? d.date.slice(5) : '' }))

  return (
    <div style={{ width: '100%', height: 180 }}>
      <ResponsiveContainer>
        <AreaChart data={shortDates} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {faultDates.map((date) => (
            <ReferenceLine key={date} x={date.slice(5)} stroke="#ef444466" strokeDasharray="4 2" />
          ))}
          <Area
            type="monotone" dataKey="sessions" stroke="#00d4ff" strokeWidth={2}
            fill="url(#cyanGrad)" animationDuration={1500}
          />
          <Area
            type="monotone" dataKey="kwh" stroke="#7c3aed" strokeWidth={2}
            fill="url(#violetGrad)" animationDuration={1800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
