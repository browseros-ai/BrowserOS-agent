/**
 * Factory function to create tools with automatic telemetry tracking
 * 
 * This wrapper adds telemetry tracking to any DynamicStructuredTool
 * using Braintrust's wrapTraced for proper nested span visualization.
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { BraintrustEventCollector } from './BraintrustEventCollector'

/**
 * Creates a tracked version of a DynamicStructuredTool
 * Uses Braintrust's wrapTraced for automatic input/output/error tracking
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

  // Wrap the tool function with Braintrust's wrapTraced
  // This automatically captures inputs, outputs, and errors
  const wrappedFunc = wrapTraced(
    originalFunc,
    {
      type: 'tool',
      name: `tool:${toolName}`,
      parent: context.parentSpanId
    }
  )

  // Create a new tool with the wrapped function
  return new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    func: async (input: any): Promise<string> => {
      const startTime = performance.now()
      
      try {
        // Execute the wrapped tool function
        // wrapTraced automatically handles span creation and logging
        const result = await wrappedFunc(input)
        
        // Log to console for visibility
        const duration = performance.now() - startTime
        console.log(`%c→ Tool: ${toolName} (${duration.toFixed(0)}ms)`, 'color: #888; font-size: 10px')
        
        return result
      } catch (error) {
        const duration = performance.now() - startTime
        console.error(`%c✗ Tool: ${toolName} failed (${duration.toFixed(0)}ms)`, 'color: #f44; font-size: 10px', error)
        throw error
      }
    }
  })
}