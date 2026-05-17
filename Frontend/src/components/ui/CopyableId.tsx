'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { copyToClipboard, cn } from '@/lib/utils'

export function CopyableId({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Click to copy"
      className={cn(
        'group inline-flex items-center gap-1.5 font-mono text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer',
        className
      )}
    >
      <span>{value}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? (
          <Check className="w-3 h-3 text-green-400" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </span>
    </button>
  )
}
