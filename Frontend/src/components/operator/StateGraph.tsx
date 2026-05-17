'use client'
import { motion } from 'framer-motion'
import { useOperatorStore } from '@/store/operatorStore'
import { STATE_EDGES, STATE_LAYOUT, STATE_SUFFIX, type StateName } from '@/lib/voltTypes'

const VB_W = 1000
const VB_H = 480
const NODE_W = 132
const NODE_H = 56

type Status = 'pending' | 'active' | 'visited' | 'eliminated'

function px(x: number, y: number): [number, number] {
  return [x * VB_W, y * VB_H]
}

function nodeStatus(name: StateName, current: StateName, visited: Set<StateName>, eliminated: Set<StateName>): Status {
  if (eliminated.has(name)) return 'eliminated'
  if (current === name) return 'active'
  if (visited.has(name)) return 'visited'
  return 'pending'
}

function edgeStatus(from: StateName, to: StateName, visited: Set<StateName>, eliminated: Set<StateName>): Status {
  if (eliminated.has(to)) return 'eliminated'
  if (visited.has(from) && visited.has(to)) return 'visited'
  return 'pending'
}

const NODE_FILL: Record<Status, string> = {
  pending: 'rgba(255,255,255,0.02)',
  active: 'rgba(0,212,255,0.12)',
  visited: 'rgba(0,212,255,0.08)',
  eliminated: 'rgba(255,255,255,0.02)',
}
const NODE_STROKE: Record<Status, string> = {
  pending: 'rgba(255,255,255,0.08)',
  active: '#00d4ff',
  visited: '#00d4ff',
  eliminated: 'rgba(255,255,255,0.10)',
}
const NODE_TEXT: Record<Status, string> = {
  pending: '#64748b',
  active: '#ffffff',
  visited: '#e2e8f0',
  eliminated: '#475569',
}

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} Q ${mx} ${y1}, ${mx} ${(y1 + y2) / 2} T ${x2} ${y2}`
}

export function StateGraph() {
  const { currentState, visited, eliminated, lastTransition } = useOperatorStore()

  return (
    <div className="glass rounded-xl panel-shadow flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-electric/20 to-cyan-electric/10 flex items-center justify-center">
          <span className="text-cyan-electric text-[10px] font-bold tracking-widest">SM</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">State Machine</p>
          <p className="text-[10px] text-slate-500">Tool-gated · physically enforced</p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-full">
          <defs>
            <pattern id="hash" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Edges */}
          {STATE_EDGES.map(([from, to]) => {
            const [fx, fy] = px(STATE_LAYOUT[from].x, STATE_LAYOUT[from].y)
            const [tx, ty] = px(STATE_LAYOUT[to].x, STATE_LAYOUT[to].y)
            const status = edgeStatus(from, to, visited, eliminated)
            const isFresh =
              lastTransition &&
              lastTransition.from === from &&
              lastTransition.to === to &&
              performance.now() - lastTransition.at < 1200

            const stroke =
              status === 'visited' ? '#00d4ff' :
              status === 'eliminated' ? 'rgba(255,255,255,0.10)' :
              'rgba(255,255,255,0.12)'
            const dash = status === 'visited' ? '' : status === 'eliminated' ? '6 6' : '4 4'

            const dx = tx - fx, dy = ty - fy
            const len = Math.hypot(dx, dy) || 1
            const nx = dx / len, ny = dy / len
            const sx = fx + nx * (NODE_W / 2)
            const sy = fy + ny * (NODE_H / 2)
            const ex = tx - nx * (NODE_W / 2)
            const ey = ty - ny * (NODE_H / 2)
            const d = curve(sx, sy, ex, ey)

            return (
              <g key={`${from}->${to}`}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={status === 'visited' ? 2.5 : 1.8}
                  strokeDasharray={dash}
                  initial={isFresh ? { pathLength: 0 } : false}
                  animate={isFresh ? { pathLength: 1 } : {}}
                  transition={isFresh ? { duration: 0.8, ease: [0.165, 0.84, 0.44, 1] } : undefined}
                />
                {isFresh && lastTransition?.confidence != null && (
                  <ForkBadge x={(sx + ex) / 2} y={(sy + ey) / 2} confidence={lastTransition.confidence} />
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {(Object.keys(STATE_LAYOUT) as Array<keyof typeof STATE_LAYOUT>).map((name) => {
            const layout = STATE_LAYOUT[name]
            const [cx, cy] = px(layout.x, layout.y)
            const status = nodeStatus(name as StateName, currentState, visited, eliminated)
            return (
              <Node key={name} cx={cx} cy={cy} label={layout.label} status={status} suffix={STATE_SUFFIX[name]} />
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function Node({ cx, cy, label, status }: { cx: number; cy: number; label: string; status: Status; suffix: string }) {
  const x = cx - NODE_W / 2
  const y = cy - NODE_H / 2
  const isActive = status === 'active'
  return (
    <g>
      {isActive && (
        <motion.rect
          x={x - 8} y={y - 8} width={NODE_W + 16} height={NODE_H + 16} rx={14}
          fill="#00d4ff" opacity={0.2}
          initial={{ opacity: 0.35, scale: 1 }}
          animate={{ opacity: 0, scale: 1.18 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      )}
      <motion.rect
        x={x} y={y} width={NODE_W} height={NODE_H} rx={10}
        fill={NODE_FILL[status]} stroke={NODE_STROKE[status]} strokeWidth={isActive ? 3 : 2}
        strokeDasharray={status === 'eliminated' ? '5 4' : ''}
        animate={{ fill: NODE_FILL[status], stroke: NODE_STROKE[status] }}
        transition={{ duration: 0.4 }}
      />
      {status === 'eliminated' && (
        <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={10} fill="url(#hash)" />
      )}
      {status === 'visited' && (
        <g transform={`translate(${x + NODE_W - 16}, ${y + 12})`}>
          <circle r={7} fill="#00d4ff" />
          <path d="M -3 0 L -1 2.2 L 3 -2.5" stroke="#0a0a0f" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fontWeight={isActive ? 600 : 500} fill={NODE_TEXT[status]}>
        {label}
      </text>
    </g>
  )
}

function ForkBadge({ x, y, confidence }: { x: number; y: number; confidence: number }) {
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <rect x={x - 26} y={y - 11} width={52} height={22} rx={11} fill="#0a0a0f" stroke="#00d4ff" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight={600} fill="#00d4ff" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {confidence.toFixed(2)}
      </text>
    </motion.g>
  )
}
