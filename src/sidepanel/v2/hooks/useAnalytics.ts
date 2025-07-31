import { useCallback, useRef } from 'react'
import { z } from 'zod'

// Analytics event schema
const AnalyticsEventSchema = z.object({
  category: z.string(),  // Event category (e.g., 'chat', 'navigation', 'feature')
  action: z.string(),  // Event action (e.g., 'send_message', 'click_reset', 'use_example')
  label: z.string().optional(),  // Optional label for additional context
  value: z.number().optional(),  // Optional numeric value
  metadata: z.record(z.unknown()).optional()  // Additional metadata
})

type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>

// Analytics configuration
interface AnalyticsConfig {
  enabled: boolean  // Whether analytics is enabled
  debug: boolean  // Log events to console in development
  endpoint?: string  // Analytics endpoint URL
  userId?: string  // Anonymous user ID
}

// Default configuration
const DEFAULT_CONFIG: AnalyticsConfig = {
  enabled: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV === 'development',
}

// Event queue for batching
const eventQueue: AnalyticsEvent[] = []
let flushTimeout: NodeJS.Timeout | null = null

/**
 * Hook for tracking analytics events
 * Provides a simple interface for tracking user interactions
 */
export function useAnalytics(config: Partial<AnalyticsConfig> = {}) {
  const configRef = useRef<AnalyticsConfig>({ ...DEFAULT_CONFIG, ...config })
  
  // Track event
  const track = useCallback((event: AnalyticsEvent) => {
    const cfg = configRef.current
    
    // Validate event
    try {
      AnalyticsEventSchema.parse(event)
    } catch (error) {
      console.error('Invalid analytics event:', error)
      return
    }
    
    // Add timestamp
    const eventWithTimestamp = {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    }
    
    // Debug logging
    if (cfg.debug) {
      console.log('[Analytics]', eventWithTimestamp)
    }
    
    // Skip if disabled
    if (!cfg.enabled) return
    
    // Add to queue
    eventQueue.push(eventWithTimestamp as AnalyticsEvent)
    
    // Schedule flush
    if (flushTimeout) clearTimeout(flushTimeout)
    flushTimeout = setTimeout(flushEvents, 5000)  // Flush every 5 seconds
    
    // Immediate flush if queue is large
    if (eventQueue.length >= 20) {
      flushEvents()
    }
  }, [])
  
  // Track click events
  const trackClick = useCallback((label: string, value?: number) => {
    track({
      category: 'interaction',
      action: 'click',
      label,
      value
    })
  }, [track])
  
  // Track feature usage
  const trackFeature = useCallback((featureName: string, metadata?: Record<string, unknown>) => {
    track({
      category: 'feature',
      action: 'use',
      label: featureName,
      metadata
    })
  }, [track])
  
  // Track errors
  const trackError = useCallback((error: Error | string, metadata?: Record<string, unknown>) => {
    track({
      category: 'error',
      action: 'occurred',
      label: typeof error === 'string' ? error : error.message,
      metadata: {
        ...metadata,
        stack: typeof error === 'object' ? error.stack : undefined
      }
    })
  }, [track])
  
  // Track timing
  const trackTiming = useCallback((label: string, duration: number) => {
    track({
      category: 'performance',
      action: 'timing',
      label,
      value: Math.round(duration)
    })
  }, [track])
  
  return {
    track,
    trackClick,
    trackFeature,
    trackError,
    trackTiming
  }
}

// Helper functions

function getSessionId(): string {
  // Get or create session ID
  const key = 'nxtscape_session_id'
  let sessionId = sessionStorage.getItem(key)
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    sessionStorage.setItem(key, sessionId)
  }
  
  return sessionId
}

function flushEvents() {
  if (eventQueue.length === 0) return
  
  // Get events to send
  const events = [...eventQueue]
  eventQueue.length = 0
  
  // Clear timeout
  if (flushTimeout) {
    clearTimeout(flushTimeout)
    flushTimeout = null
  }
  
  // In production, send to analytics endpoint
  // For now, just log that we would send
  if (process.env.NODE_ENV === 'production') {
    console.log('[Analytics] Would send', events.length, 'events')
    // TODO: Implement actual sending to analytics service
    // fetch(endpoint, { method: 'POST', body: JSON.stringify(events) })
  }
}

// Flush events on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushEvents)
}