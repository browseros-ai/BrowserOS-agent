import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { toolError, toolSuccess } from '@/lib/tools/Tool.interface';
import { SubAgent } from './SubAgent';

// Input schema for SubAgentTool
const SubAgentInputSchema = z.object({
  task: z.string(),  // The task to accomplish
  description: z.string()  // Additional context/description for the task
});

type SubAgentInput = z.infer<typeof SubAgentInputSchema>;

/**
 * Factory function to create SubAgentTool
 * This tool spawns a sub-agent to handle complex multi-step tasks
 */
export function createSubAgentTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'sub_agent',
    description: `Spawn a sub-agent to handle multi-step tasks that require planning, execution, and validation cycles. Use this for tasks that need multiple steps and verification.`,
    schema: SubAgentInputSchema,
    func: async (args: SubAgentInput): Promise<string> => {
      try {
        // Log the start of subagent execution
        const eventProcessor = executionContext.getEventProcessor();
        eventProcessor.info(`🤖 Starting sub-agent for task: ${args.task}`);
        
        // Create and execute the sub-agent
        const subAgent = new SubAgent(
          executionContext,
          args.task,
          args.description
        );
        
        const result = await subAgent.execute();
        
        // Log completion
        // if (result.success) {
        //   eventProcessor.info(`✅ Sub-agent completed successfully`);
        // } else {
        //   eventProcessor.info(`❌ Sub-agent failed: ${result.error || 'Unknown error'}`);
        // }
        
        // Return standard tool output format
        if (result.success) {
          return JSON.stringify(toolSuccess(result.summary));
        } else {
          const errorDetail = result.error ? `${result.summary} - ${result.error}` : result.summary;
          return JSON.stringify(toolError(errorDetail));
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if this is an abort
        if (error instanceof Error && error.name === "AbortError") {
          return JSON.stringify(toolError('Sub-agent was cancelled'));
        }
        
        return JSON.stringify(toolError(`Sub-agent failed: ${errorMessage}`));
      }
    }
  });
}
