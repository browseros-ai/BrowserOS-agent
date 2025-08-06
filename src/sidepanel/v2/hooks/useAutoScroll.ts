import { useEffect, useRef, useState, useCallback } from 'react'

// Throttle function to limit scroll event frequency
const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean
  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

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
  const lastScrollTopRef = useRef<number>(0)

  // Memoize scroll handler to prevent recreation on every render
  const handleScroll = useCallback(throttle(() => {
    const container = containerRef.current
    if (!container) return

    const currentScrollTop = container.scrollTop
    const lastScrollTop = lastScrollTopRef.current
    
    // Only process if scroll position actually changed
    if (currentScrollTop === lastScrollTop) return
    
    lastScrollTopRef.current = currentScrollTop

    // Check if user is near bottom (within 100px)
    const isNearBottom = 
      container.scrollHeight - currentScrollTop - container.clientHeight < 100
    
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
  }, 16), []) // Throttle to ~60fps

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Initialize last scroll position
    lastScrollTopRef.current = container.scrollTop

    container.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeoutRef.current)
    }
  }, [handleScroll])

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

  // Memoize scrollToBottom function to prevent recreation
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    })
    setIsUserScrolling(false)
  }, [])

  return {
    containerRef,
    isUserScrolling,
    scrollToBottom
  }
}