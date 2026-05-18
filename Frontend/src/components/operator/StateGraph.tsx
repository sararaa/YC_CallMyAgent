'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, GitBranch } from 'lucide-react'
import { useOperatorStore } from '@/store/operatorStore'
import { STATE_EDGES, STATE_LAYOUT, STATE_SUFFIX, type StateName } from '@/lib/voltTypes'

const VB_W = 1000
const VB_H = 460
const NODE_W = 160
const NODE_H = 64

type Status = 'pending' | 'active' | 'visited' | 'eliminated'

function r(n: number): number {
  return Math.round(n * 100) / 100
}

function px(x: number, y: number): [number, number] {
  return [r(x * VB_W), r(y * VB_H)]
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
  pending:    '#18181b',
  active:     '#1e1b4b',
  visited:    '#1c1917',
  eliminated: '#111113',
}
const NODE_STROKE: Record<Status, string> = {
  pending:    '#3f3f46',
  active:     '#6366f1',
  visited:    '#4f7c5a',
  eliminated: '#27272a',
}
const NODE_TEXT: Record<Status, string> = {
  pending:    '#71717a',
  active:     '#e0e7ff',
  visited:    '#bbf7d0',
  eliminated: '#3f3f46',
}

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const mx = r((x1 + x2) / 2)
  const my = r((y1 + y2) / 2)
  return `M ${r(x1)} ${r(y1)} Q ${mx} ${r(y1)}, ${mx} ${my} T ${r(x2)} ${r(y2)}`
}

export function StateGraph() {
  const { currentState, visited, eliminated, lastTransition, stateFocus } = useOperatorStore()
  const [selected, setSelected] = useState<StateName | null>(null)

  return (
    <div className="panel panel-shadow flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-[15px] font-medium text-text-primary">State machine</span>
          <span className="text-[15px] text-text-muted">· click a node to inspect</span>
        </div>
        <span className="text-[15px] font-medium text-cyan-electric bg-cyan-electric/10 px-2 py-0.5 rounded-md border border-cyan-electric/20">
          {currentState}
        </span>
      </div>

      <div className="flex-1 min-h-0 relative">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-full">
          <defs>
            <pattern id="hash" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#3f3f46" strokeWidth="1" />
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
              status === 'visited'    ? '#4f7c5a' :
              status === 'eliminated' ? '#27272a' :
              '#3f3f46'
            const dash = status === 'visited' ? '' : status === 'eliminated' ? '5 5' : '4 4'

            const dx = tx - fx, dy = ty - fy
            const len = Math.hypot(dx, dy) || 1
            const nx = dx / len, ny = dy / len
            const sx = r(fx + nx * (NODE_W / 2))
            const sy = r(fy + ny * (NODE_H / 2))
            const ex = r(tx - nx * (NODE_W / 2))
            const ey = r(ty - ny * (NODE_H / 2))
            const d = curve(sx, sy, ex, ey)

            return (
              <g key={`${from}->${to}`}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={status === 'visited' ? 2 : 1.5}
                  strokeDasharray={dash}
                  initial={isFresh ? { pathLength: 0 } : false}
                  animate={isFresh ? { pathLength: 1 } : {}}
                  transition={isFresh ? { duration: 0.8, ease: [0.165, 0.84, 0.44, 1] } : undefined}
                />
                {isFresh && lastTransition?.confidence != null && (
                  <ForkBadge x={r((sx + ex) / 2)} y={r((sy + ey) / 2)} confidence={lastTransition.confidence} />
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {(Object.keys(STATE_LAYOUT) as Array<keyof typeof STATE_LAYOUT>).map((name) => {
            const layout = STATE_LAYOUT[name]
            const [cx, cy] = px(layout.x, layout.y)
            const status = nodeStatus(name as StateName, currentState, visited, eliminated)
            const focus = stateFocus[name as StateName] || ''
            return (
              <Node
                key={name}
                cx={cx} cy={cy}
                label={layout.label}
                status={status}
                focus={focus}
                onClick={() => setSelected(name as StateName)}
              />
            )
          })}
        </svg>

        <AnimatePresence>
          {selected && (
            <NodeDetail
              key={selected}
              name={selected}
              focus={stateFocus[selected] || ''}
              status={nodeStatus(selected, currentState, visited, eliminated)}
              onClose={() => setSelected(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function NodeDetail({ name, focus, status, onClose }: {
  name: StateName; focus: string; status: Status; onClose: () => void
}) {
  const label = STATE_LAYOUT[name as Exclude<StateName, 'ended'>]?.label || name
  const suffix = STATE_SUFFIX[name as Exclude<StateName, 'ended'>] || ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(600px,calc(100%-24px))] z-20 rounded-lg bg-bg-card border border-border p-4 shadow-xl"
    >
      <button onClick={onClose} className="absolute top-3 right-3 text-text-muted hover:text-text-secondary p-1 rounded transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn(
          'text-[15px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider',
          status === 'active'     ? 'bg-cyan-electric/15 text-cyan-electric border border-cyan-electric/25' :
          status === 'visited'    ? 'bg-green-neon/10 text-green-neon/80 border border-green-neon/20' :
          status === 'eliminated' ? 'bg-bg-hover text-text-muted border border-border' :
          'bg-bg-hover text-text-muted border border-border'
        )}>
          {status}
        </span>
        <h3 className="text-[15px] font-semibold text-text-primary">{label}</h3>
      </div>
      {focus && (
        <div className="mb-3 pl-3 border-l-2 border-cyan-electric/40">
          <p className="text-[15px] text-text-muted mb-0.5">Current focus</p>
          <p className="text-[15px] text-text-secondary italic">"{focus}"</p>
        </div>
      )}
      <div>
        <p className="text-[15px] text-text-muted mb-1">Stage prompt</p>
        <p className="text-[15px] text-text-secondary leading-relaxed">{suffix}</p>
      </div>
    </motion.div>
  )
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

function Node({ cx, cy, label, status, focus, onClick }: {
  cx: number; cy: number; label: string; status: Status; focus: string; onClick: () => void
}) {
  const x = cx - NODE_W / 2
  const y = cy - NODE_H / 2
  const isActive = status === 'active'
  const showFocus = focus && (isActive || status === 'visited')
  const labelY = showFocus ? cy - 6 : cy + 5
  const truncated = focus.length > 24 ? focus.slice(0, 23) + '…' : focus

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }} role="button">
      {/* Active pulse ring */}
      {isActive && (
        <motion.rect
          x={x - 6} y={y - 6} width={NODE_W + 12} height={NODE_H + 12} rx={13}
          fill="none"
          stroke="#6366f1"
          strokeWidth={1.5}
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.12 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      )}

      {/* Node body */}
      <motion.rect
        x={x} y={y} width={NODE_W} height={NODE_H} rx={8}
        fill={NODE_FILL[status]}
        stroke={NODE_STROKE[status]}
        strokeWidth={isActive ? 1.5 : 1}
        strokeDasharray={status === 'eliminated' ? '4 3' : ''}
        animate={{ fill: NODE_FILL[status], stroke: NODE_STROKE[status] }}
        transition={{ duration: 0.35 }}
      />

      {/* Eliminated hash overlay */}
      {status === 'eliminated' && (
        <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={8} fill="url(#hash)" opacity={0.4} />
      )}

      {/* Visited checkmark */}
      {status === 'visited' && (
        <g transform={`translate(${x + NODE_W - 14}, ${y + 10})`}>
          <path d="M -4 0 L -1.5 2.5 L 4 -3" stroke="#4ade80" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}

      {/* Label */}
      <text
        x={cx} y={labelY}
        textAnchor="middle"
        fontSize="15"
        fontWeight={isActive ? 600 : 500}
        fontFamily="var(--font-geist-sans)"
        fill={NODE_TEXT[status]}
        letterSpacing="-0.01em"
      >
        {label}
      </text>

      {/* Focus text */}
      {showFocus && (
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill={isActive ? '#818cf8' : '#52525b'} fontStyle="italic">
          {truncated}
        </text>
      )}
    </g>
  )
}

function ForkBadge({ x, y, confidence }: { x: number; y: number; confidence: number }) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    >
      <rect x={x - 24} y={y - 10} width={48} height={20} rx={10} fill="#1e1b4b" stroke="#6366f1" strokeWidth={1} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fontWeight={600} fill="#818cf8" fontFamily="var(--font-geist-mono)">
        {confidence.toFixed(2)}
      </text>
    </motion.g>
  )
}
