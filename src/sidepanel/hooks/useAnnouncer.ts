import { useEffect, useRef } from 'react'

/**
 * Hook for making screen reader announcements
 * Creates a visually hidden live region for accessibility
 */
export function useAnnouncer() {
  const announcerRef = useRef<HTMLDivElement | null>(null)
  
  useEffect(() => {
    // Create announcer element
    const announcer = document.createElement('div')
    announcer.setAttribute('role', 'status')
    announcer.setAttribute('aria-live', 'polite')
    announcer.setAttribute('aria-atomic', 'true')
    
    // Visually hide but keep accessible to screen readers
    announcer.style.position = 'absolute'
    announcer.style.left = '-10000px'
    announcer.style.width = '1px'
    announcer.style.height = '1px'
    announcer.style.overflow = 'hidden'
    
    document.body.appendChild(announcer)
    announcerRef.current = announcer
    
    return () => {
      document.body.removeChild(announcer)
      announcerRef.current = null
    }
  }, [])
  
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcerRef.current) return
    
    // Update aria-live if needed
    announcerRef.current.setAttribute('aria-live', priority)
    
    // Clear and set new message
    announcerRef.current.textContent = ''
    
    // Use timeout to ensure screen reader picks up the change
    setTimeout(() => {
      if (announcerRef.current) {
        announcerRef.current.textContent = message
      }
    }, 100)
  }
  
  return { announce }
}

/**
 * Global announcer instance for use across the app
 */
let globalAnnouncer: ReturnType<typeof useAnnouncer> | null = null

export function getGlobalAnnouncer() {
  if (!globalAnnouncer) {
    console.warn('Global announcer not initialized. Use useAnnouncer in your root component.')
  }
  return globalAnnouncer
}

export function setGlobalAnnouncer(announcer: ReturnType<typeof useAnnouncer>) {
  globalAnnouncer = announcer
}