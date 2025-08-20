/**
 * Factory function to create tools with automatic telemetry tracking
 * 
 * This wrapper adds lightweight metrics tracking to any DynamicStructuredTool.
 * Input/output is already captured in MessageManager, so we only track:
 * - Execution duration
 * - Success/failure status
 * - Error counts for monitoring
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { BraintrustEventCollector } from './BraintrustEventCollector'

/**
 * Creates a tracked version of a DynamicStructuredTool
 * Only tracks metrics - actual I/O is in MessageManager
 */
export function createTrackedTool(
  tool: DynamicStructuredTool,
  context: ExecutionContext
): DynamicStructuredTool {
  const originalFunc = tool.func
  const toolName = tool.name
  const telemetry = context.telemetry as BraintrustEventCollector | null

  // If telemetry is not enabled, return the original tool
  if (!telemetry?.isEnabled() || !context.parentSpanId) {
    return tool
  }

  // Get wrapTraced from Braintrust for proper tool tracing
  const wrapTraced = telemetry.getWrapTraced()
  if (!wrapTraced) {
    // Fallback to original tool if wrapTraced is not available
    return tool
  }

  // wrapTraced automatically creates spans for visualization
  // We only track metrics - actual I/O is in MessageManager
  const trackedFunc = wrapTraced(
    async (input: any, span: any) => {
      const startTime = performance.now()
      
      try {
        // Execute the original tool function
        const result = await originalFunc(input)
        const duration = performance.now() - startTime
        
        // Check if tool returned an error (soft error - tool handled it)
        let isError = false
        let errorMessage: string | undefined
        try {
          const parsedResult = JSON.parse(result)
          if (parsedResult && typeof parsedResult.ok === 'boolean') {
            isError = !parsedResult.ok
            if (isError && parsedResult.error) {
              errorMessage = parsedResult.error
            }
          }
        } catch {
          // If parsing fails, assume success
          isError = false
        }
        
        // Log metrics to console
        if (isError) {
          console.error(`%c✗ Tool: ${toolName} failed (${duration.toFixed(0)}ms)`, 'color: #f44; font-size: 10px')
          
          // Track error count for monitoring
          if (telemetry && 'toolErrorCounts' in telemetry) {
            const errorCount = ((telemetry as any).toolErrorCounts.get(toolName) || 0) + 1;
            (telemetry as any).toolErrorCounts.set(toolName, errorCount)
          }
        } else {
          console.log(`%c→ Tool: ${toolName} (${duration.toFixed(0)}ms)`, 'color: #888; font-size: 10px')
        }
        
        // Log metrics to Braintrust
        if (span && span.log) {
          const logData: any = {
            metrics: {
              duration_ms: duration,
              success: !isError ? 1 : 0
            },
            metadata: {
              tool_name: toolName,
              messageIndex: context.messageManager.getMessages().length  // Reference to MessageManager
            }
          }
          
          // For soft errors (ok: false), add structured error object
          if (isError) {
            // Add error info to span for context
            logData.error = {
              name: 'Tool error',
              message: `${toolName}: ${errorMessage || 'Tool returned ok: false'}`,
              // No stack trace for soft errors
            }
            logData.metadata.error_kind = 'logical'  // Logical error vs runtime error
            logData.metrics.tool_error_count = (telemetry as any).toolErrorCounts.get(toolName) || 1
            
            // IMPORTANT: Add to Tool errors logs for Braintrust's reserved field
            logData.logs = {
              'Tool errors': [{
                name: toolName,
                error: errorMessage || 'Tool returned ok: false',
                errorType: 'logical_error',
                input: input,
                timestamp: Date.now()
              }]
            }
          }
          
          span.log(logData)
        }
        
        // For errors, also log a separate error event to make it show as red in Braintrust
        if (isError && telemetry) {
          await telemetry.logEvent({
            type: 'error',  // Use 'error' type to show as red
            name: `${toolName}_error`,
            data: {
              toolName,
              input,
              output: result,
              duration_ms: duration,
              success: false,
              error: errorMessage || 'Tool returned ok: false',
              errorType: 'logical_error'
            },
            // CRITICAL: Add structured error at top level for Braintrust error tracking
            error: {
              name: 'Tool error',
              message: `${toolName}: ${errorMessage || 'Tool returned ok: false'}`
            }
          }, {
            parent: context.parentSpanId || undefined,
            name: `${toolName}_error`
          })
        }
        
        return result  // Always return the result for agent to handle
        
      } catch (error: any) {
        // Real exception thrown by tool
        const duration = performance.now() - startTime
        console.error(`%c✗ Tool: ${toolName} exception (${duration.toFixed(0)}ms)`, 'color: #f44; font-size: 10px', error)
        
        // Track exception count for monitoring
        if (telemetry && 'toolErrorCounts' in telemetry) {
          const errorCount = ((telemetry as any).toolErrorCounts.get(toolName) || 0) + 1;
          (telemetry as any).toolErrorCounts.set(toolName, errorCount)
        }
        
        // Log error in Braintrust's expected format
        if (span && span.log) {
          span.log({
            // Add error info to span for context
            error: {
              name: 'Tool error',
              message: `${toolName}: ${error?.message ?? String(error)}`,
              stack: error?.stack
            },
            metadata: {
              tool_name: toolName,
              tool_input: input,  // Include input for debugging (omit if sensitive)
              error_kind: 'runtime',  // Tool runtime error
              messageIndex: context.messageManager.getMessages().length
            },
            metrics: {
              duration_ms: duration,
              success: 0,
              is_exception: 1,
              tool_error_count: (telemetry as any).toolErrorCounts.get(toolName) || 1
            },
            // IMPORTANT: Add to Tool errors logs for Braintrust's reserved field
            logs: {
              'Tool errors': [{
                name: toolName,
                error: error?.message ?? String(error),
                errorType: 'runtime_exception',
                errorName: error?.name ?? 'Error',
                input: input,
                timestamp: Date.now()
              }]
            }
          })
        }
        
        // Also log a separate error event to make it show as red in Braintrust
        if (telemetry) {
          await telemetry.logEvent({
            type: 'error',  // Use 'error' type to show as red
            name: `${toolName}_exception`,
            data: {
              toolName,
              input,
              duration_ms: duration,
              success: false,
              error: error?.message ?? String(error),
              errorType: 'runtime_exception'
            },
            // CRITICAL: Add structured error at top level for Braintrust error tracking
            error: {
              name: 'Tool error',
              message: `${toolName}: ${error?.message ?? String(error)}`,
              stack: error?.stack
            }
          }, {
            parent: context.parentSpanId || undefined,
            name: `${toolName}_exception`
          })
        }
        
        // Re-throw the error to preserve behavior
        throw error
      } finally {
        // Ensure span is properly ended
        if (span && span.end) {
          span.end()
        }
      }
    },
    {
      type: 'tool',
      name: toolName,
      parent: context.parentSpanId
    }
  )

  // Create a new tool with the wrapped function
  return new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    func: trackedFunc
  })
}