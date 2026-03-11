import { motion, useMotionValue, useSpring } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import EyesClosed from '@/assets/mascot/eyes-closed.png'
import EyesOpen from '@/assets/mascot/eyes-open.png'

const BLINK_INTERVAL_MS = 3000
const BLINK_DURATION_MS = 150
const HEAD_MOVE_RANGE = 8

// Head occupies roughly top 52% of the 2048x2048 image
const HEAD_CLIP = 'inset(0 0 48% 0)'
const BODY_CLIP = 'inset(42% 0 0 0)'

export const Mascot = () => {
  const [isBlinking, setIsBlinking] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const headX = useMotionValue(0)
  const headY = useMotionValue(0)
  const smoothX = useSpring(headX, { stiffness: 150, damping: 20 })
  const smoothY = useSpring(headY, { stiffness: 150, damping: 20 })

  // Periodic blink with slight randomness
  useEffect(() => {
    const scheduleBlink = () => {
      const jitter = Math.random() * 2000 - 1000
      return setTimeout(() => {
        setIsBlinking(true)
        setTimeout(() => setIsBlinking(false), BLINK_DURATION_MS)
        timerId = scheduleBlink()
      }, BLINK_INTERVAL_MS + jitter)
    }
    let timerId = scheduleBlink()
    return () => clearTimeout(timerId)
  }, [])

  // Track cursor and map to head offset
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) / window.innerWidth
      const dy = (e.clientY - cy) / window.innerHeight
      headX.set(dx * HEAD_MOVE_RANGE * 2)
      headY.set(dy * HEAD_MOVE_RANGE)
    }
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [headX, headY])

  const currentSrc = isBlinking ? EyesClosed : EyesOpen

  return (
    <motion.div
      ref={containerRef}
      className="relative h-[260px] w-[200px] shrink-0"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
    >
      <motion.div
        className="h-full w-full"
        animate={{ y: [0, -4, 0] }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
      >
        {/* Body — static, clipped to bottom portion */}
        <img
          src={currentSrc}
          alt="BrowserOS mascot"
          className="absolute inset-0 h-full w-full object-contain"
          style={{ clipPath: BODY_CLIP }}
          draggable={false}
        />

        {/* Head — follows cursor, clipped to top portion */}
        <motion.img
          src={currentSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          style={{ clipPath: HEAD_CLIP, x: smoothX, y: smoothY }}
          draggable={false}
        />
      </motion.div>
    </motion.div>
  )
}
