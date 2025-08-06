// components/Icons.tsx
import React, { useState, useEffect, useRef } from 'react'


export const ArrowDownIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 14l-7 7m0 0l-7-7m7 7V3"
    />
  </svg>
)

export const XIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
)

export const SunIcon = () => (
  <svg
    className="w-3 h-3 text-white"
    fill="currentColor"
    viewBox="0 0 20 20"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
    />
  </svg>
)

export const MoonIcon = () => (
  <svg
    className="w-3 h-3 text-white"
    fill="currentColor"
    viewBox="0 0 20 20"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"
    />
  </svg>
)

export const UserIcon = () => (
  <svg
    className="w-4 h-4"
    fill="currentColor"
    viewBox="0 0 20 20"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
    />
  </svg>
)

export const TabsIcon = () => (
  <svg
    className="w-3 h-3 mr-1"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
)

export const CloseIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
)

export const SendIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
    />
  </svg>
)

export const SettingsIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 
         2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 
         2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 
         1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 
         0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 
         2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
)

export const ChevronDownIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
)

export const ChevronUpIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 15l7-7 7 7"
    />
  </svg>
)

// used in MessageList
export const AnimatedPawPrints = ({
  delay = 9000,
  speed = 4,
  opacity = 0.3
}: {
  delay?: number
  speed?: number
  opacity?: number
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [fadeOutProgress, setFadeOutProgress] = useState(0) // 0 = not fading, 1 = fully faded

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let fadeOutInterval: ReturnType<typeof setInterval>

    const start = () => {
      setIsRunning(true)
      setFadeOutProgress(0)

      // Start fade-out after `speed` seconds
      setTimeout(() => {
        const startTime = Date.now()
        const fadeOutDuration = 1500 // 1.5 seconds
        
        // Update fade-out progress every 16ms (60fps)
        fadeOutInterval = setInterval(() => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(1, elapsed / fadeOutDuration)
          setFadeOutProgress(progress)
          
          if (progress >= 1) {
            clearInterval(fadeOutInterval)
            setIsRunning(false)
            
            // Wait for `delay` before starting the next cycle
            timer = setTimeout(start, delay)
          }
        }, 16)
      }, speed * 1000)
    }

    // Initial delay before first run
    timer = setTimeout(start, delay)

    return () => {
      clearTimeout(timer)
      clearInterval(fadeOutInterval)
    }
  }, [delay, speed])

  if (!isRunning) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {[...Array(8)].map((_, step) => {
        const isLeft = step % 2 === 0
        const size = 28 - step * 1.8
        const delay = step * 0.3
        const x = -50 + step * 18
        const y = 80 - step * 10 + (isLeft ? -8 : 8)

        // Calculate fade-out opacity
        let currentOpacity = opacity * (1 - step * 0.04)
        if (fadeOutProgress > 0) {
          currentOpacity *= (1 - fadeOutProgress)
        }

        return (
          <div
            key={step}
            className="absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${size}px`,
              height: `${size}px`,
              opacity: currentOpacity,
              animation: `paw-run-across-diagonal ${speed}s ease-in-out ${delay}s forwards`,
              transform: `rotate(${isLeft ? -5 : 5}deg)`
            }}
          >
            <PawIcon variant="brand" />
          </div>
        )
      })}
    </div>
  )
}
// used in bottom of chat input (going to move location probably)
export const LoadingPawTrail = () => {
  const [visibleSteps, setVisibleSteps] = useState<Array<{ step: number; id: string }>>([])
  const animationCounterRef = useRef(0)

  useEffect(() => {
    const animate = () => {
      setVisibleSteps([])
      animationCounterRef.current += 1
      const currentCounter = animationCounterRef.current
      
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          setVisibleSteps(prev => [...prev, { step: i, id: `${currentCounter}-${i}` }])
        }, i * 200)
      }
      setTimeout(() => {
        setVisibleSteps([])
        setTimeout(animate, 500)
      }, 1500)
    }
    animate()
  }, [])

  return (
    <div className="relative inline-flex items-center h-4 w-12">
      {visibleSteps.map(({ step, id }) => {
        const size = 8 - step * 1.5
        const left = `${step * 12}px`
        const opacity = 1 - step * 0.3

        return (
          <div
            key={id}
            className="absolute"
            style={{
              left,
              width: `${size}px`,
              height: `${size}px`,
              opacity,
              animation: 'paw-fade-in 0.3s ease-out'
            }}
          >
            <PawIcon variant="default" />
          </div>
        )
      })}
    </div>
  )
}
// used in AnimatedPawPrints and LoadingPawTrail
export const PawIcon = ({ variant = 'default' }: { variant?: 'brand' | 'default' }) => (
  <svg
    fill={variant === 'brand' ? 'hsl(var(--brand))' : 'currentColor'}
    viewBox="0 0 24 24"
    className="w-full h-full"
    aria-hidden="true"
  >
    <path d="M19.5 18c1 1.6 1.5 2.4 1.5 3.3 0 1.7-1.3 2.6-3 2.6-.8 0-1.3 0-2.5-.6-.8-.7-2.7-.7-2.7-.7-.8 0-1.9.7-2.7.7-1.3.6-1.7.6-2.5.6-1.7 0-3-1-3-2.6 0-.9.5-1.7 1.5-3.3 1.9-3.2 3.6-4.7 3.6-4.7.5 0 1.2 0 2.7 0s2.2 0 2.7 0c1.9 1.5 3.9 4.7 3.9 4.7zm-3.9-7.5c1.8 0 3.3-2.3 3.3-5.2S17.4 0 15.6 0s-3.3 2.3-3.3 5.2 1.5 5.2 3.3 5.2zm-8.1 0c1.8 0 3.3-2.3 3.3-5.2S9.3 0 7.5 0 4.2 2.3 4.2 5.2s1.5 5.2 3.3 5.2zm-4.2 5.2c1.3-.6 1.6-2.8.7-4.9S2 8.3.7 8.9s-1.6 2.8-.7 4.9 2.8 1.7 4.2 1.1zm12.3 0c1.3.6 3.2-.5 4.2-1.1s1.6-2.8.7-4.9-2.9-2.2-4.2-1.6-1.6 2.8-.7 4.9z" />
  </svg>
)




