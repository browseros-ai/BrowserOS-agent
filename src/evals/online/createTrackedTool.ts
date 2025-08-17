/**
 * Factory function to create tools with automatic telemetry tracking
 * 
 * This wrapper adds telemetry tracking to any DynamicStructuredTool
 * without modifying the original tool implementation.
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { BraintrustEventCollector } from './BraintrustEventCollector'

/**
 * Wraps a tool creation function to add automatic telemetry tracking
 * 
 * @param createToolFn - Original tool creation function
 * @param toolName - Optional override for tool name in telemetry
 * @returns Wrapped tool creation function with telemetry
 */
export function withTelemetry<T extends any[]>(
  createToolFn: (context: ExecutionContext, ...args: T) => DynamicStructuredTool,
  toolName?: string
): (context: ExecutionContext, ...args: T) => DynamicStructuredTool {
  return (context: ExecutionContext, ...args: T) => {
    const tool = createToolFn(context, ...args)
    const originalFunc = tool.func
    const actualToolName = toolName || tool.name

    // Wrap the tool's func with telemetry tracking
    tool.func = async (input: any): Promise<string> => {
      const telemetry = context.telemetry as BraintrustEventCollector | null
      
      // If telemetry is not enabled, just run the original function
      if (!telemetry?.isEnabled() || !context.parentSpanId) {
        return originalFunc(input)
      }

      const startTime = performance.now()

      try {
        // Execute the tool
        const result = await originalFunc(input)
        const duration = performance.now() - startTime

        // Track tool completion
        await telemetry.logEvent({
          type: 'tool_execution' as any,
          name: actualToolName,
          data: {
            phase: 'end',
            input: sanitizeToolInput(input, actualToolName),
            output: sanitizeToolOutput(result, actualToolName),
            duration_ms: duration,
            success: isSuccessfulOutput(result)
          }
        }, {
          parent: context.parentSpanId,
          name: actualToolName
        })
        
        // Log to console for visibility
        console.log(`%c→ Tool: ${actualToolName} (${duration.toFixed(0)}ms)`, 'color: #888; font-size: 10px')

        return result
      } catch (error) {
        const duration = performance.now() - startTime
        
        // Log tool error
        await telemetry.logEvent({
          type: 'tool_execution' as any,
          name: actualToolName,
          data: {
            phase: 'error',
            duration_ms: duration,
            error: error instanceof Error ? error.message : String(error),
            input: sanitizeToolInput(input, actualToolName)
          }
        }, {
          parent: context.parentSpanId,
          name: `${actualToolName}_error`
        })

        throw error
      }
    }

    return tool
  }
}

/**
 * Creates a tracked version of a DynamicStructuredTool
 * Use this when you already have a tool instance
 */
export function createTrackedTool(
  tool: DynamicStructuredTool,
  context: ExecutionContext
): DynamicStructuredTool {
  const originalFunc = tool.func
  const toolName = tool.name

  return new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    func: async (input: any): Promise<string> => {
      const telemetry = context.telemetry as BraintrustEventCollector | null
      
      if (!telemetry?.isEnabled() || !context.parentSpanId) {
        return originalFunc(input)
      }

      const startTime = performance.now()

      try {
        const result = await originalFunc(input)
        const duration = performance.now() - startTime

        await telemetry.logEvent({
          type: 'tool_execution' as any,
          name: toolName,
          data: {
            phase: 'end',
            input: sanitizeToolInput(input, toolName),
            output: sanitizeToolOutput(result, toolName),
            duration_ms: duration,
            success: isSuccessfulOutput(result)
          }
        }, {
          parent: context.parentSpanId,
          name: toolName
        })
        
        console.log(`%c→ Tool: ${toolName} (${duration.toFixed(0)}ms)`, 'color: #888; font-size: 10px')

        return result
      } catch (error) {
        const duration = performance.now() - startTime
        
        await telemetry.logEvent({
          type: 'tool_execution' as any,
          name: toolName,
          data: {
            phase: 'error',
            duration_ms: duration,
            error: error instanceof Error ? error.message : String(error),
            input: sanitizeToolInput(input, toolName)
          }
        }, {
          parent: context.parentSpanId,
          name: `${toolName}_error`
        })

        throw error
      }
    }
  })
}

/**
 * Check if tool output indicates success
 */
function isSuccessfulOutput(output: any): boolean {
  if (!output) return false
  
  // Handle JSON string outputs
  if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output)
      return parsed.ok === true || parsed.success === true
    } catch {
      return true  // Non-JSON string output is considered success
    }
  }
  
  // Handle object outputs
  if (typeof output === 'object') {
    return output.ok === true || output.success === true
  }
  
  return true
}

/**
 * Sanitize tool output for telemetry
 * Removes large data and sensitive information
 */
function sanitizeToolOutput(output: any, toolName: string): any {
  if (!output) return undefined
  
  // Handle string outputs (JSON results from tools)
  if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output)
      return sanitizeToolOutput(parsed, toolName)
    } catch {
      // If not JSON, truncate if too long
      return output.length > 500 ? output.substring(0, 500) + '...[truncated]' : output
    }
  }
  
  // Handle object outputs
  if (typeof output === 'object') {
    const sanitized = JSON.parse(JSON.stringify(output))
    
    // Truncate large fields
    if (sanitized.output && typeof sanitized.output === 'string' && sanitized.output.length > 500) {
      sanitized.output = sanitized.output.substring(0, 500) + '...[truncated]'
    }
    
    // Remove HTML content if present
    if (sanitized.html) {
      sanitized.html = '[HTML content removed]'
      sanitized.htmlLength = output.html?.length
    }
    
    // Remove base64 data
    if (sanitized.screenshot) {
      sanitized.screenshot = '[BASE64_DATA]'
    }
    
    return sanitized
  }
  
  return output
}

/**
 * Sanitize tool input for telemetry based on tool type
 * Removes sensitive data and truncates large inputs
 */
function sanitizeToolInput(input: any, toolName: string): any {
  if (!input) return undefined

  // Clone to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(input))

  // Tool-specific sanitization
  switch (toolName) {
    case 'interact_tool':
      // Don't log passwords or sensitive form data
      if (sanitized.text && sanitized.operation === 'input_text') {
        const lowerText = sanitized.text.toLowerCase()
        if (lowerText.includes('password') || 
            lowerText.includes('secret') || 
            lowerText.includes('token') ||
            lowerText.includes('key')) {
          sanitized.text = '[REDACTED]'
        }
      }
      break

    case 'extract_tool':
      // Truncate large extraction targets
      if (sanitized.content_type === 'full_content') {
        sanitized.content_type = 'full_content_request'
        delete sanitized.selectors  // Don't need to log selectors
      }
      break

    case 'screenshot_tool':
      // Remove base64 data if present
      if (sanitized.screenshot) {
        sanitized.screenshot = '[BASE64_DATA]'
      }
      break

    case 'planner_tool':
      // Truncate very long task descriptions
      if (sanitized.task && sanitized.task.length > 200) {
        sanitized.task = sanitized.task.substring(0, 200) + '...[truncated]'
      }
      break
  }

  // General truncation for all tools
  const stringFields = ['url', 'selector', 'text', 'query']
  for (const field of stringFields) {
    if (sanitized[field] && typeof sanitized[field] === 'string' && sanitized[field].length > 500) {
      sanitized[field] = sanitized[field].substring(0, 500) + '...[truncated]'
    }
  }

  return sanitized
}
