import { useEffect, useRef, useState } from 'react'

/**
 * Hook to handle auto-scrolling behavior for a scrollable container
 * Automatically scrolls to bottom on new content unless user is scrolling
 */
export function useAutoScroll<T extends HTMLElement>(
  dependencies: any[] = []
) {
  const containerRef = useRef<T>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      // Check if user is near bottom (within 100px)
      const isNearBottom = 
        container.scrollHeight - container.scrollTop - container.clientHeight < 100
      
      // If user scrolled away from bottom, they're manually scrolling
      if (!isNearBottom) {
        setIsUserScrolling(true)
        
        // Reset after 3 seconds of no scrolling
        clearTimeout(scrollTimeoutRef.current)
        scrollTimeoutRef.current = setTimeout(() => {
          setIsUserScrolling(false)
        }, 3000)
      } else {
        setIsUserScrolling(false)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeoutRef.current)
    }
  }, [])

  // Auto-scroll when dependencies change (new content)
  useEffect(() => {
    const container = containerRef.current
    if (!container || isUserScrolling) return

    // Use requestAnimationFrame for smooth scrolling
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    })
  }, dependencies)

  return {
    containerRef,
    isUserScrolling,
    scrollToBottom: () => {
      const container = containerRef.current
      if (!container) return
      
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
      setIsUserScrolling(false)
    }
  }
}