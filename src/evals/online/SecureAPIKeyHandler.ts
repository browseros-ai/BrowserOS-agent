/**
 * Secure API Key Handler for Production Use
 * 
 * SECURITY CRITICAL: This module ensures API keys never leave the
 * privileged background script context. Content scripts and the side
 * panel communicate through message passing, keeping sensitive data secure.
 * 
 * Architecture:
 * 1. Background script holds API keys in memory (never exposed)
 * 2. Content scripts send eval messages without keys
 * 3. Background script adds keys and forwards to Braintrust
 * 4. Results are returned without exposing keys
 * 
 * This prevents:
 * - API key exposure in DevTools
 * - Key leakage through DOM inspection
 * - Malicious script access to credentials
 */

import { z } from 'zod'

// Message schemas ensure type safety across extension boundaries
// Each message type corresponds to a BraintrustEventCollector method

const LogEventMessageSchema = z.object({
  type: z.literal('EVAL_LOG_EVENT'),  // Message identifier
  event: z.any(),                      // Event data to log
  options: z.object({                  // Optional parameters
    parent: z.string().optional(),     // Parent span ID
    name: z.string().optional()        // Custom span name
  }).optional()
})

const StartSessionMessageSchema = z.object({
  type: z.literal('EVAL_START_SESSION'),
  metadata: z.any()  // Session context (task, browser info, etc.)
})

const EndSessionMessageSchema = z.object({
  type: z.literal('EVAL_END_SESSION'),
  parent: z.string().optional(),  // Parent span from startSession
  sessionId: z.string(),          // Session identifier
  result: z.any()                 // Final results and metrics
})

// Union type for all eval messages
type EvalMessage = 
  | z.infer<typeof LogEventMessageSchema>
  | z.infer<typeof StartSessionMessageSchema>
  | z.infer<typeof EndSessionMessageSchema>

/**
 * Background script handler for secure API key usage
 * 
 * IMPORTANT: This function MUST be called in background/index.ts
 * It sets up the message handler that content scripts communicate with.
 * 
 * Example setup in background/index.ts:
 * ```typescript
 * import { setupSecureEvalHandler } from '@/evals/online/SecureAPIKeyHandler'
 * setupSecureEvalHandler()  // Call during background script initialization
 * ```
 */
export function setupSecureEvalHandler() {
  // Ensure we're in the background script context
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
    console.warn('SecureEvalHandler can only run in background script')
    return
  }
  
  // Lazy initialization - collector is created only when needed
  let collector: any = null
  
  const getCollector = async () => {
    if (!collector) {
      // Dynamic import prevents BraintrustEventCollector from being
      // bundled into content scripts, keeping API keys secure
      const { BraintrustEventCollector } = await import('./BraintrustEventCollector')
      collector = BraintrustEventCollector.getInstance()
    }
    return collector
  }
  
  // Set up Chrome message handler for eval requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Filter for eval-specific messages
    if (!message?.type?.startsWith('EVAL_')) {
      return false  // Let other handlers process non-eval messages
    }
    
    // Handle async operations with proper error handling
    (async () => {
      try {
        const evalCollector = await getCollector()
        
        // Route messages to appropriate collector methods
        switch (message.type) {
          case 'EVAL_LOG_EVENT': {
            // Log an event within a session
            const msg = LogEventMessageSchema.parse(message)
            await evalCollector.logEvent(msg.event, msg.options)
            sendResponse({ success: true })
            break
          }
          
          case 'EVAL_START_SESSION': {
            // Start a new tracking session
            const msg = StartSessionMessageSchema.parse(message)
            const result = await evalCollector.startSession(msg.metadata)
            sendResponse({ success: true, parent: result.parent })  // Return parent ID
            break
          }
          
          case 'EVAL_END_SESSION': {
            // Complete a session with results
            const msg = EndSessionMessageSchema.parse(message)
            await evalCollector.endSession(msg.parent, msg.sessionId, msg.result)
            sendResponse({ success: true })
            break
          }
          
          case 'EVAL_CHECK_ENABLED': {
            // Check if tracking is enabled
            const enabled = evalCollector.isEnabled()
            sendResponse({ success: true, enabled })
            break
          }
          
          default:
            sendResponse({ success: false, error: 'Unknown eval message type' })
        }
      } catch (error) {
        // Return errors to the caller without exposing internals
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    })()
    
    // CRITICAL: Return true for async response
    // Without this, Chrome closes the message channel prematurely
    return true
  })
  
  console.log('SecureEvalHandler initialized in background script')
}

/**
 * Client-side proxy for secure event collection
 * 
 * This class provides the same interface as BraintrustEventCollector
 * but routes all calls through the background script via message passing.
 * This ensures API keys never reach content scripts or the side panel.
 * 
 * Usage in content scripts or side panel:
 * ```typescript
 * import { SecureEventCollectorProxy } from '@/evals/online/SecureAPIKeyHandler'
 * 
 * const collector = SecureEventCollectorProxy.getInstance()
 * const { parent } = await collector.startSession({ task: 'user task' })
 * await collector.logEvent({ type: 'tool_execution', ... }, { parent })
 * ```
 */
export class SecureEventCollectorProxy {
  private static instance: SecureEventCollectorProxy | null = null
  
  /**
   * Get singleton instance (matches BraintrustEventCollector interface)
   */
  static getInstance(): SecureEventCollectorProxy {
    if (!SecureEventCollectorProxy.instance) {
      SecureEventCollectorProxy.instance = new SecureEventCollectorProxy()
    }
    return SecureEventCollectorProxy.instance
  }
  
  /**
   * Send message to background script and await response
   * Handles Chrome API errors and response validation
   */
  private sendMessage(message: EvalMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      // Ensure Chrome runtime is available
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        reject(new Error('Chrome runtime not available'))
        return
      }
      
      // Send message and handle response
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          // Handle Chrome API errors
          reject(chrome.runtime.lastError)
        } else if (!response?.success) {
          // Handle application-level errors
          reject(new Error(response?.error || 'Unknown error'))
        } else {
          // Success - return the response
          resolve(response)
        }
      })
    })
  }
  
  async isEnabled(): Promise<boolean> {
    try {
      const response = await this.sendMessage({ 
        type: 'EVAL_CHECK_ENABLED' as any 
      })
      return response.enabled || false
    } catch {
      return false
    }
  }
  
  async startSession(metadata: any): Promise<{ parent?: string }> {
    try {
      const response = await this.sendMessage({
        type: 'EVAL_START_SESSION',
        metadata
      })
      return { parent: response.parent }
    } catch (error) {
      console.warn('Failed to start eval session:', error)
      return { parent: undefined }
    }
  }
  
  async logEvent(event: any, options: { parent?: string; name?: string } = {}): Promise<void> {
    try {
      await this.sendMessage({
        type: 'EVAL_LOG_EVENT',
        event,
        options
      })
    } catch (error) {
      // Fail silently to not disrupt execution
      console.debug('Failed to log eval event:', error)
    }
  }
  
  async endSession(parent: string | undefined, sessionId: string, result: any): Promise<void> {
    try {
      await this.sendMessage({
        type: 'EVAL_END_SESSION',
        parent,
        sessionId,
        result
      })
    } catch (error) {
      console.warn('Failed to end eval session:', error)
    }
  }
  
  /**
   * OpenAI client is not available in content scripts
   * The wrapped client with automatic tracking only works in background script
   * where the actual API keys are stored.
   */
  get openai() {
    console.warn('OpenAI client wrapping not available in content scripts. Use in background script only.')
    return null
  }
}

/**
 * === PRODUCTION SETUP GUIDE ===
 * 
 * Step 1: Initialize handler in background script
 * In background/index.ts:
 * ```typescript
 * import { setupSecureEvalHandler } from '@/evals/online/SecureAPIKeyHandler'
 * 
 * // Call during background script initialization
 * setupSecureEvalHandler()
 * ```
 * 
 * Step 2: Use proxy in content scripts/side panel
 * In BrowserAgent or any content script:
 * ```typescript
 * import { SecureEventCollectorProxy } from '@/evals/online/SecureAPIKeyHandler'
 * 
 * const collector = SecureEventCollectorProxy.getInstance()
 * 
 * // Start a session
 * const { parent } = await collector.startSession({
 *   sessionId: 'unique-id',
 *   task: 'user request',
 *   timestamp: Date.now()
 * })
 * 
 * // Log events
 * await collector.logEvent({
 *   type: 'tool_execution',
 *   name: 'NavigationTool',
 *   data: { url: 'https://example.com' }
 * }, { parent })
 * 
 * // End session
 * await collector.endSession(parent, 'unique-id', {
 *   success: true,
 *   summary: 'Task completed'
 * })
 * ```
 * 
 * Security Benefits:
 * - API keys stored only in background script memory
 * - Content scripts never see credentials
 * - Keys not visible in DevTools or DOM
 * - Resistant to XSS and injection attacks
 */
