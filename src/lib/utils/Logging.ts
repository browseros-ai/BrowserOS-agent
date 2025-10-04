import { MessageType } from '@/lib/types/messaging'
import { isDevelopmentMode } from '@/config'
import { getBrowserOSAdapter } from '@/lib/browser/BrowserOSAdapter'
import { z } from 'zod'
import posthog from 'posthog-js'

/**
 * Log level type
 */
export const LogLevelSchema = z.enum(['info', 'error', 'warning'])
export type LogLevel = z.infer<typeof LogLevelSchema>

/**
 * Log message schema
 */
export const LogMessageSchema = z.object({
  source: z.string(),
  message: z.string(),
  level: LogLevelSchema,
  timestamp: z.string()
})

export type LogMessage = z.infer<typeof LogMessageSchema>

/**
 * Options for initializing the logging utility
 */
interface LogUtilityOptions {
  readonly debugMode?: boolean
}

/**
 * Centralized logging utility that supports both port and one-time messaging
 * Routes logs to options page when in development mode
 */
export class Logging {
  private static connectedPorts = new Map<string, chrome.runtime.Port>()
  private static debugMode = false
  private static browserOSAdapter = getBrowserOSAdapter()
  private static posthogInitialized = false
  private static posthogApiKey = process.env.POSTHOG_API_KEY
  
  public static initialize(options: LogUtilityOptions = {}): void {
    this.debugMode = options.debugMode || false

    if (this.posthogApiKey && !this.posthogInitialized) {
      posthog.init(this.posthogApiKey, {
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
      })
      this.posthogInitialized = true
    }
  }
  
  /**
   * Register a connected port
   * @param name - Port name
   * @param port - Connected port
   */
  public static registerPort(name: string, port: chrome.runtime.Port): void {
    this.connectedPorts.set(name, port)
  }
  
  /**
   * Unregister a port
   * @param name - Port name
   */
  public static unregisterPort(name: string): void {
    this.connectedPorts.delete(name)
  }
  
  /**
   * Log a message
   * @param source - Source component name
   * @param message - Message content
   * @param level - Log level
   */
  public static log(source: string, message: string, level: LogLevel = 'info'): void {
    if (!this.debugMode && level === 'info') return
    
    const prefix = `[${source}]`
    
    // Console logging
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`)
        break
      case 'warning':
        console.warn(`${prefix} ${message}`)
        break
      default:
        console.log(`${prefix} ${message}`)
    }
    
    // Prepare log message
    const logMessage: LogMessage = {
      source,
      message,
      level,
      timestamp: new Date().toISOString()
    }
    
    // Try to send via port messaging first
    let sentViaPort = false
    
    // In development mode, send to options page
    if (isDevelopmentMode()) {
      // Look for any options page port
      let optionsPort: chrome.runtime.Port | undefined
      let optionsPortName: string | undefined
      
      for (const [name, port] of this.connectedPorts.entries()) {
        if (name === 'options') {
          optionsPort = port
          optionsPortName = name
          break
        }
      }
      
      if (optionsPort && optionsPortName) {
        try {
          // Check if port is still connected by accessing a property
          // Chrome will throw if the port is disconnected
          const isConnected = optionsPort.name !== undefined
          
          if (isConnected) {
            optionsPort.postMessage({
              type: MessageType.LOG,
              payload: logMessage
            })
            sentViaPort = true
          } else {
            // Port is stale, remove it
            this.unregisterPort(optionsPortName)
          }
        } catch (error) {
          // Port is disconnected or stale, remove it silently
          this.unregisterPort(optionsPortName!)
          // Don't log disconnected port errors - they're expected when pages close
        }
      }
    }
    
    // Fall back to one-time messaging if port messaging failed
    if (!sentViaPort && typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: MessageType.LOG,
        payload: logMessage
      }).catch((_error: Error) => {
        // It's OK if this fails too, just means no UI is open
        // We've already logged to the console above
      })
    }
  }

  /**
   * Log a metric event using the BrowserOS metrics API with PostHog fallback
   * @param eventName - Name of the event (will be prefixed with "agent.")
   * @param properties - Optional properties to include with the event
   * @param sampling - Sampling rate between 0 and 1 (default 1.0 = 100%)
   */
  public static async logMetric(eventName: string, properties?: Record<string, any>, sampling: number = 1.0): Promise<void> {
    // Apply sampling
    if (Math.random() > sampling) {
      return
    }
    
    const prefixedEventName = `agent.${eventName}`
    
    // Get manifest version
    let version: string | undefined
    try {
      const manifest = chrome.runtime.getManifest()
      version = manifest.version
    } catch {
      // Chrome runtime not available, continue without version
    }
    
    const enhancedProperties = {
      ...properties,
      ...(version && { version })
    }
    
    try {
      await this.browserOSAdapter.logMetric(prefixedEventName, enhancedProperties)
    } catch (error) {
      // BrowserOS failed, use PostHog fallback
      if (this.posthogApiKey && this.posthogInitialized) {
        try {
          posthog.capture('agent.metric_api_failed', { event: eventName, ...(version && { version }) })
          posthog.capture(prefixedEventName, enhancedProperties)
        } catch (posthogError) {
        }
      }
    }
  }
}
