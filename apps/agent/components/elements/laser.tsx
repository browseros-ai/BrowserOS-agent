import { motion } from 'framer-motion'
import { type FC, useEffect, useState } from 'react'

type LaserProps = {
  /** The id of the element to target */
  targetId: string
  /** Animation duration in seconds */
  duration?: number
  /** Delay before firing in seconds */
  delay?: number
  /** Laser color (any CSS color) */
  color?: string
  className?: string
}

/**
 * @public
 */
export const Laser: FC<LaserProps> = ({
  targetId,
  duration = 0.3,
  delay = 0,
  color = 'var(--accent-orange)',
  className = '',
}) => {
  const [targetY, setTargetY] = useState<number | null>(null)
  const [fire, setFire] = useState(false)

  // Measure target’s bottom position relative to viewport
  useEffect(() => {
    const updatePosition = () => {
      const target = document.getElementById(targetId)
      if (target) {
        const rect = target.getBoundingClientRect()
        setTargetY(window.innerHeight - rect.bottom)
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)

    const timeout = setTimeout(() => setFire(true), delay * 1000)

    return () => {
      window.removeEventListener('resize', updatePosition)
      clearTimeout(timeout)
    }
  }, [targetId, delay])

  return (
    <>
      {fire && targetY !== null && (
        <>
          {/* Laser beam */}
          <motion.div
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -targetY, opacity: 0 }}
            transition={{
              duration,
              ease: 'easeOut',
            }}
            className={`pointer-events-none fixed bottom-0 left-1/2 h-10 w-[3px] -translate-x-1/2 rounded-full shadow-[0_0_15px] ${className}`}
            style={{
              backgroundColor: color,
              boxShadow: `0 0 15px ${color}`,
            }}
          />

          {/* Impact flash */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.3, 0.8] }}
            transition={{ duration: 0.2, delay: duration }}
            style={{
              position: 'fixed',
              left: '50%',
              bottom: targetY - 2,
              transform: 'translateX(-50%)',
              backgroundColor: color,
              filter: 'blur(4px)',
            }}
            className="pointer-events-none h-2 w-2 rounded-full"
          />
        </>
      )}
    </>
  )
}
