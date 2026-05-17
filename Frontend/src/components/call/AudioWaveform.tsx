'use client'
import { useCallStore } from '@/store/callStore'

const BAR_COUNT = 20
const BAR_HEIGHTS = [8, 14, 20, 12, 18, 24, 10, 22, 16, 14, 20, 8, 18, 24, 12, 16, 22, 10, 14, 20]

export function AudioWaveform() {
  const { status } = useCallStore()
  const isActive = status === 'active'

  return (
    <div className="flex items-center justify-center gap-[3px] h-10 px-2">
      {BAR_HEIGHTS.map((height, i) => (
        <div
          key={i}
          className="wave-bar rounded-full transition-all duration-300"
          style={{
            '--bar-height': `${height}px`,
            animationDelay: `${(i * 0.05).toFixed(2)}s`,
            animationPlayState: isActive ? 'running' : 'paused',
            height: isActive ? undefined : '3px',
            opacity: isActive ? 0.9 : 0.3,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
