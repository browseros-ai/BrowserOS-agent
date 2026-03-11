import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import MascotBody from '@/assets/mascot/body.png'
import MascotHeadClosed from '@/assets/mascot/head-eyes-closed.png'
import MascotHeadOpen from '@/assets/mascot/head-eyes-open.png'

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
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
    >
      {/* Gentle idle bob */}
      <motion.div
        className="relative"
        animate={{ y: [0, -6, 0] }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
      >
        {/* Head — positioned to overlap the body's neck area */}
        <div
          className="relative z-10 flex justify-center"
          style={{ marginBottom: -28 }}
        >
          <div className="relative h-[100px] w-[100px]">
            <img
              src={MascotHeadOpen}
              alt=""
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-75 ${isBlinking ? 'opacity-0' : 'opacity-100'}`}
              draggable={false}
            />
            <img
              src={MascotHeadClosed}
              alt=""
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-75 ${isBlinking ? 'opacity-100' : 'opacity-0'}`}
              draggable={false}
            />
          </div>
        </div>

        {/* Body */}
        <div className="relative h-[120px] w-[120px]">
          <img
            src={MascotBody}
            alt="BrowserOS mascot"
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
