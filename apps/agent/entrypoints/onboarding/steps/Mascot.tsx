import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import EyesClosed from '@/assets/mascot/eyes-closed.png'
import EyesOpen from '@/assets/mascot/eyes-open.png'

const BLINK_INTERVAL_MS = 3000
const BLINK_DURATION_MS = 150

export const Mascot = () => {
  const [isBlinking, setIsBlinking] = useState(false)

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

  return (
    <motion.div
      className="relative h-[180px] w-[140px] shrink-0"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
    >
      <motion.div
        className="h-full w-full"
        animate={{ y: [0, -6, 0] }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
      >
        <img
          src={EyesOpen}
          alt="BrowserOS mascot"
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-75 ${isBlinking ? 'opacity-0' : 'opacity-100'}`}
          draggable={false}
        />
        <img
          src={EyesClosed}
          alt=""
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-75 ${isBlinking ? 'opacity-100' : 'opacity-0'}`}
          draggable={false}
        />
      </motion.div>
    </motion.div>
  )
}
