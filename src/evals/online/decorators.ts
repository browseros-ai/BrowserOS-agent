/**
 * Decorators for automatic event tracking
 * 
 * TypeScript decorators provide a clean way to add telemetry without
 * cluttering business logic. These decorators wrap methods to automatically
 * track their execution, inputs, outputs, and errors.
 * 
 * Key patterns:
 * - Decorator factory pattern for configuration
 * - Async wrapper to handle promises properly
 * - Parent/child span relationships for trace hierarchy
 * - Silent failures to prevent telemetry from breaking the app
 */

import { BraintrustEventCollector } from './BraintrustEventCollector'
import { Logging } from '@/lib/utils/Logging'

// Configuration options for tracking decorators
interface TrackingMetadata {
  eventType: string           // Event type for filtering/grouping
  className?: string          // Class context for the method
  methodName?: string         // Method being tracked
  includeArgs?: boolean       // Log method arguments (be careful with sensitive data)
  includeResult?: boolean     // Log method return value
  maxArgLength?: number       // Truncate long arguments
  parent?: string            // Parent span ID for trace nesting
}

/**
 * Generic method tracking decorator
 * Wraps any method to track its execution lifecycle
 * 
 * Usage:
 * ```typescript
 * class MyService {
 *   @track('service_call', { includeArgs: true })
 *   async processData(input: string) { ... }
 * }
 * ```
 * 
 * @param eventType - Category of event for filtering
 * @param options - Additional tracking configuration
 */
export function track(
  eventType: string = 'method_execution',
  options: Partial<TrackingMetadata> = {}
) {
  // Decorator function that TypeScript calls at runtime
  return function (
    target: any,                    // Class prototype
    propertyKey: string,            // Method name
    descriptor: PropertyDescriptor  // Method descriptor
  ) {
    const originalMethod = descriptor.value
    const className = target.constructor.name
    
    // Replace method with tracking wrapper
    descriptor.value = async function (this: any, ...args: any[]) {
      const collector = BraintrustEventCollector.getInstance()
      
      // Skip tracking if disabled (zero overhead when off)
      if (!collector.isEnabled()) {
        return originalMethod.apply(this, args)
      }
      
      const fullMethodName = `${className}.${propertyKey}`
      const startTime = performance.now()
      
      // Look for parent span ID in instance context
      // Convention: classes can store parentSpanId for trace hierarchy
      const parent = options.parent || (this as any).parentSpanId
      
      // Warn about missing parent in development
      if (!parent && process.env.NODE_ENV !== 'production') {
        console.warn(
          `[BrowserOS Eval] Missing parent span for ${fullMethodName}. ` +
          `Event will be orphaned. Consider calling startSession() first or storing parentSpanId.`
        )
      }
      
      try {
        // Track method entry
        await collector.logEvent({
          type: eventType as any,
          name: fullMethodName,
          data: {
            phase: 'start',
            className,
            methodName: propertyKey,
            args: options.includeArgs ? 
              truncateArgs(args, options.maxArgLength || 500) : undefined
          }
        }, { parent, name: `${fullMethodName}_start` })
        
        // Execute the actual method
        const result = await originalMethod.apply(this, args)
        
        // Track successful completion
        await collector.logEvent({
          type: eventType as any,
          name: fullMethodName,
          data: {
            phase: 'end',
            duration_ms: performance.now() - startTime,
            success: true,
            hasResult: result !== undefined,
            resultPreview: options.includeResult ? 
              truncateResult(result, 100) : undefined
          }
        }, { parent, name: `${fullMethodName}_end` })
        
        return result
      } catch (error) {
        // Track errors without breaking execution
        await collector.logEvent({
          type: eventType as any,
          name: fullMethodName,
          data: {
            phase: 'error',
            duration_ms: performance.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error ? error.constructor.name : 'Unknown',
            stack: process.env.NODE_ENV === 'development' && error instanceof Error ? 
              error.stack : undefined  // Only include stack traces in dev
          }
        }, { parent, name: `${fullMethodName}_error` })
        
        throw error  // Re-throw to maintain original behavior
      }
    }
    
    return descriptor
  }
}

/**
 * @deprecated Use wrapOpenAI from Braintrust instead for automatic LLM tracking
 * 
 * If you need to track LLM calls, use the wrapped OpenAI client:
 * ```
 * const collector = BraintrustEventCollector.getInstance()
 * const openai = collector.openai  // Pre-wrapped with tracking
 * const response = await openai.chat.completions.create({...})
 * ```
 * 
 * This automatically tracks:
 * - Prompts and completions
 * - Token usage
 * - Model name
 * - Latency
 * - Streaming responses
 */
export function trackLLM(modelName?: string) {
  // Log deprecation warning
  console.warn('trackLLM decorator is deprecated. Use wrapOpenAI from Braintrust for automatic LLM tracking.')
  
  // Return a pass-through decorator for backward compatibility
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    return descriptor
  }
}

/**
 * Specialized decorator for LangChain tool execution
 * Understands tool-specific patterns like JSON results and ok/success flags
 * 
 * Usage:
 * ```typescript
 * class NavigationTool {
 *   @trackTool('navigate')
 *   async execute(input: { url: string }) { ... }
 * }
 * ```
 * 
 * @param toolName - Override the tool name for clearer traces
 */
export function trackTool(toolName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (this: any, ...args: any[]) {
      const collector = BraintrustEventCollector.getInstance()
      
      if (!collector.isEnabled()) {
        return originalMethod.apply(this, args)
      }
      
      const actualToolName = toolName || propertyKey
      const startTime = performance.now()
      
      // Tools should have parentSpanId from the agent context
      const parent = this.parentSpanId
      
      // Warn about missing parent in development
      if (!parent && process.env.NODE_ENV !== 'production') {
        console.warn(
          `[BrowserOS Eval] Missing parent span for tool ${actualToolName}. ` +
          `Event will be orphaned. Consider calling startSession() first or storing parentSpanId.`
        )
      }
      
      try {
        // Track tool invocation with sanitized input
        await collector.logEvent({
          type: 'tool_execution',
          name: actualToolName,
          data: {
            phase: 'start',
            input: sanitizeToolInput(args[0])  // Redact sensitive fields
          }
        }, { parent, name: `tool_${actualToolName}` })
        
        // Execute the tool
        const result = await originalMethod.apply(this, args)
        
        // Parse tool result to determine success
        // Most tools return JSON strings with { ok: boolean, output: any }
        let parsedResult = result
        let success = false
        
        try {
          if (typeof result === 'string') {
            parsedResult = JSON.parse(result)
          }
          // Check common success indicators
          success = parsedResult?.ok || parsedResult?.success || false
        } catch {
          // If not JSON, assume success (no error was thrown)
          success = true
        }
        
        // Track tool completion with result preview
        await collector.logEvent({
          type: 'tool_execution',
          name: actualToolName,
          data: {
            phase: 'end',
            duration_ms: performance.now() - startTime,
            success,
            outputPreview: getOutputPreview(parsedResult)
          }
        }, { parent, name: `tool_${actualToolName}_result` })
        
        return result
      } catch (error) {
        // Track tool failures
        await collector.logEvent({
          type: 'tool_execution',
          name: actualToolName,
          data: {
            phase: 'error',
            duration_ms: performance.now() - startTime,
            error: error instanceof Error ? error.message : String(error)
          }
        }, { parent, name: `tool_${actualToolName}_error` })
        
        throw error
      }
    }
    
    return descriptor
  }
}

/**
 * Decorator for browser automation actions
 * Tracks DOM interactions, navigation, and page manipulations
 * 
 * Usage:
 * ```typescript
 * class BrowserPage {
 *   @trackBrowserAction('click')
 *   async click(selector: string) { ... }
 * }
 * ```
 * 
 * @param actionType - Type of browser action (click, navigate, scroll, etc.)
 */
export function trackBrowserAction(actionType: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value
    const className = target.constructor.name
    
    descriptor.value = async function (this: any, ...args: any[]) {
      const collector = BraintrustEventCollector.getInstance()
      
      if (!collector.isEnabled()) {
        return originalMethod.apply(this, args)
      }
      
      const fullMethodName = `${className}.${propertyKey}`
      const startTime = performance.now()
      
      // Get parent span from context
      const parent = this.parentSpanId
      
      // Warn about missing parent in development
      if (!parent && process.env.NODE_ENV !== 'production') {
        console.warn(
          `[BrowserOS Eval] Missing parent span for browser action ${actionType}. ` +
          `Event will be orphaned. Consider calling startSession() first or storing parentSpanId.`
        )
      }
      
      try {
        await collector.logEvent({
          type: 'browser_action',
          name: fullMethodName,
          data: {
            phase: 'start',
            actionType,
            target: args[0]  // Usually selector or URL
          }
        }, { parent, name: `browser_${actionType}` })
        
        const result = await originalMethod.apply(this, args)
        
        await collector.logEvent({
          type: 'browser_action',
          name: fullMethodName,
          data: {
            phase: 'end',
            duration_ms: performance.now() - startTime,
            actionType,
            success: true
          }
        }, { parent, name: `browser_${actionType}_complete` })
        
        return result
      } catch (error) {
        await collector.logEvent({
          type: 'browser_action',
          name: fullMethodName,
          data: {
            phase: 'error',
            duration_ms: performance.now() - startTime,
            actionType,
            error: error instanceof Error ? error.message : String(error)
          }
        }, { parent, name: `browser_${actionType}_error` })
        
        throw error
      }
    }
    
    return descriptor
  }
}

// === Helper Functions ===
// These utilities handle data sanitization and truncation for telemetry

/**
 * Truncate method arguments for logging
 * Prevents huge payloads from bloating telemetry data
 */
function truncateArgs(args: any[], maxLength: number): any {
  try {
    const str = JSON.stringify(args)
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + '...'
    }
    return args
  } catch {
    // Handle circular references or other serialization issues
    return '[Complex arguments]'
  }
}

/**
 * Truncate method results for logging
 * Keeps telemetry focused on success/failure rather than full data
 */
function truncateResult(result: any, maxLength: number): any {
  try {
    if (typeof result === 'string' && result.length > maxLength) {
      return result.substring(0, maxLength) + '...'
    }
    
    const str = JSON.stringify(result)
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + '...'
    }
    
    return result
  } catch {
    return '[Complex result]'
  }
}

/**
 * Remove sensitive data from tool inputs
 * Critical for privacy - never log passwords, tokens, etc.
 */
function sanitizeToolInput(input: any): any {
  if (!input) return undefined
  
  // Clone to avoid mutating original
  const sanitized: any = {}
  
  // Common sensitive field patterns
  const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'auth']
  
  for (const key in input) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      // Check if key contains sensitive patterns
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = input[key]
      }
    }
  }
  
  return sanitized
}

/**
 * Extract a preview of tool output for logging
 * Focuses on the most relevant parts of the response
 */
function getOutputPreview(output: any): string {
  if (!output) return 'undefined'
  
  if (typeof output === 'string') {
    return output.length > 100 ? output.substring(0, 100) + '...' : output
  }
  
  if (typeof output === 'object') {
    // Handle common tool response patterns
    if (output.output) {
      return getOutputPreview(output.output)  // Recursive for nested output
    }
    
    if (output.error) {
      return `Error: ${output.error}`
    }
    
    return '[Complex output]'
  }
  
  return String(output)
}
