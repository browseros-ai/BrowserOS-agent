import { useEffect, useRef, useState, useCallback } from 'react'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'

// Throttle function to limit scroll event frequency
const throttle = <T extends (...args: unknown[]) => void>(func: T, limit: number) => {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => { inThrottle = false }, limit)
    }
  }
}

// Consider within this distance from bottom as "at bottom"
const AT_BOTTOM_THRESHOLD_PX = 4

/**
 * Hook to handle auto-scrolling behavior for a scrollable container
 * Automatically scrolls to bottom on new content unless user is scrolling
 */
export function useAutoScroll<T extends HTMLElement>(
  dependencies: unknown[] = [],
  externalRef?: React.RefObject<T>
) {
  // Use external container ref if provided, otherwise manage our own
  const internalRef = useRef<T>(null)
  const containerRef = (externalRef ?? internalRef) as React.RefObject<T>
  const [isUserScrolling, setIsUserScrolling] = useState(false) // reflects auto-scroll disabled when user scrolled up
  const pinnedToBottomRef = useRef<boolean>(true)
  const autoScrollEnabled = useSettingsStore(s => s.autoScroll)

  // Memoize scroll handler to prevent recreation on every render
  const handleScroll = useCallback(throttle(() => {
    const container = containerRef.current
    if (!container) return

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    const isAtBottom = distanceFromBottom <= AT_BOTTOM_THRESHOLD_PX
    // If user scrolls up (increasing distance), lock off immediately
    if (!isAtBottom && pinnedToBottomRef.current) {
      pinnedToBottomRef.current = false
      setIsUserScrolling(true)
      return
    }
    pinnedToBottomRef.current = isAtBottom
    setIsUserScrolling(!isAtBottom)
  }, 16), []) // Throttle to ~60fps

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Initialize pinned state based on current position
    const initialDistance = container.scrollHeight - container.scrollTop - container.clientHeight
    const isAtBottom = initialDistance <= AT_BOTTOM_THRESHOLD_PX
    pinnedToBottomRef.current = isAtBottom
    setIsUserScrolling(!isAtBottom)

    container.addEventListener('scroll', handleScroll, { passive: true })

    // Also monitor direct user interactions (wheel/touch) to lock off auto-scroll immediately
    const handleUserInteract = () => {
      const el = containerRef.current
      if (!el) return
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      if (dist > AT_BOTTOM_THRESHOLD_PX) {
        pinnedToBottomRef.current = false
        setIsUserScrolling(true)
      }
    }
    container.addEventListener('wheel', handleUserInteract, { passive: true })
    container.addEventListener('touchmove', handleUserInteract, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
      container.removeEventListener('wheel', handleUserInteract)
      container.removeEventListener('touchmove', handleUserInteract)
    }
  }, [handleScroll])

  // Auto-scroll when dependencies change (new content)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Auto-scroll only if feature enabled and pinned (user hasn't scrolled up)
    if (!autoScrollEnabled || !pinnedToBottomRef.current) return

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