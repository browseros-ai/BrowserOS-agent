import React, { useEffect, useRef } from 'react'
import { cn } from '@/sidepanel/lib/utils'

interface VoiceWaveformProps {
  audioLevel: number  // 0-100 scale
  isActive: boolean
  isMuted?: boolean
  className?: string
}

const BARS_COUNT = 50  // Number of bars to display
const MAX_HEIGHT = 60  // Max bar height in pixels

/**
 * Real-time audio waveform visualization
 * Shows vertical bars representing audio levels
 */
export function VoiceWaveform({ audioLevel, isActive, isMuted = false, className }: VoiceWaveformProps) {
  const levelsRef = useRef<number[]>(new Array(BARS_COUNT).fill(0))
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!isActive) {
      // Reset when inactive
      levelsRef.current = new Array(BARS_COUNT).fill(0)
      return
    }

    // Update levels array (sliding window) - show flatline when muted
    const effectiveLevel = isMuted ? 0 : audioLevel
    levelsRef.current = [...levelsRef.current.slice(1), effectiveLevel]

    // Render waveform
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const barWidth = width / BARS_COUNT
    const centerY = height / 2

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw bars
    levelsRef.current.forEach((level, index) => {
      // Normalize level to 0-1 range
      const normalized = Math.min(level / 100, 1)

      // Calculate bar height (symmetric around center)
      const barHeight = normalized * MAX_HEIGHT

      // Bar position
      const x = index * barWidth
      const y = centerY - barHeight / 2

      // Color based on level (more intense = lighter color)
      // Gray when muted, orange when active
      const opacity = 0.3 + (normalized * 0.7)
      ctx.fillStyle = isMuted
        ? `rgba(156, 163, 175, ${opacity})`  // Gray when muted
        : `rgba(251, 101, 31, ${opacity})`  // Brand orange (hsl(19 96% 55%))

      // Draw rounded rectangle
      const radius = barWidth / 4
      ctx.beginPath()
      ctx.roundRect(x + 1, y, barWidth - 2, barHeight, radius)
      ctx.fill()
    })
  }, [audioLevel, isActive, isMuted])

  if (!isActive) {
    return null
  }

  return (
    <div className={cn('flex items-center justify-center p-4', className)}>
      <canvas
        ref={canvasRef}
        width={800}
        height={80}
        className="w-full h-20"
        style={{ imageRendering: 'crisp-edges' }}
      />
    </div>
  )
}
