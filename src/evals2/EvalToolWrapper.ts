import { DynamicStructuredTool } from '@langchain/core/tools';
import type { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Wrap a tool to track execution duration in ExecutionContext
 * Stores metrics in context.toolMetrics Map
 */
export function wrapToolForMetrics(
  tool: DynamicStructuredTool,
  context: ExecutionContext,
  toolCallId: string
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    func: async (input: any) => {
      const start = Date.now();
      
      try {
        const result = await tool.func(input);
        const duration = Date.now() - start;
        
        // Parse result to check success
        let success = true;
        try {
          const parsed = JSON.parse(result);
          success = parsed.ok !== false;
        } catch {
          // If not JSON, assume success
        }
        
        // Store metrics in ExecutionContext
        if (!context.toolMetrics) {
          context.toolMetrics = new Map();
        }
        context.toolMetrics.set(toolCallId, {
          toolName: tool.name,
          duration,
          success,
          timestamp: start
        });
        
        console.log(`⚡ Tool: ${tool.name} (${duration}ms)`);
        return result;
        
      } catch (error: any) {
        const duration = Date.now() - start;
        
        // Store error metrics
        if (!context.toolMetrics) {
          context.toolMetrics = new Map();
        }
        context.toolMetrics.set(toolCallId, {
          toolName: tool.name,
          duration,
          success: false,
          timestamp: start,
          error: error.message
        });
        
        console.error(`❌ Tool: ${tool.name} failed (${duration}ms)`);
        throw error;
      }
    }
  });
}

export { wrapToolForMetrics as wrapToolForDuration }; // Alias for compatibility