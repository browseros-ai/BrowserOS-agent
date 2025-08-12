import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { MessageManagerReadOnly} from '@/lib/runtime/MessageManager';
import { generatePlannerSystemPrompt, generatePlannerTaskPrompt } from './PlannerTool.prompt';
import { toolError } from '@/lib/tools/Tool.interface';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PLANNING_CONFIG } from './PlannerTool.config';
import { MessageType } from '@/lib/runtime/MessageManager';
import { invokeWithRetry } from '@/lib/utils/retryable';

// Input schema - simple so LLM can generate and pass it
const PlannerInputSchema = z.object({
  task: z.string(),  // Task to plan for
  max_steps: z.number().default(PLANNING_CONFIG.STEPS_PER_PLAN),  // Number of steps to plan
});

// Plan schema - simple structure for each step
const PlanSchema = z.object({
  steps: z.array(z.object({
    action: z.string(),  // What to do
    reasoning: z.string()  // Why this step
  }))
});

type PlannerInput = z.infer<typeof PlannerInputSchema>;

// Factory function to create PlannerTool
export function createPlannerTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'planner_tool',
    description: `Generate up to ${PLANNING_CONFIG.STEPS_PER_PLAN} steps for the task`,
    schema: PlannerInputSchema,
    func: async (args: PlannerInput): Promise<string> => {
      try {
        // Get LLM instance from execution context
        const llm = await executionContext.getLLM();
        
        // Create message reader inline
        const read_only_message_manager = new MessageManagerReadOnly(executionContext.messageManager);
        // Filter out browser state messages as they take up too much context
        const message_history = read_only_message_manager.getAll().filter(m => m.additional_kwargs?.messageType !== MessageType.BROWSER_STATE).map(m => `${m._getType()}: ${m.content}`).join('\n');
       
        // Get browser state using BrowserContext's method
        const browserState = await executionContext.browserContext.getBrowserStateString();
        
        // Generate prompts
        const systemPrompt = generatePlannerSystemPrompt();
        const taskPrompt = generatePlannerTaskPrompt(
          args.task,
          args.max_steps,
          message_history,
          browserState
        );
        
        // Get structured response from LLM with retry logic
        const structuredLLM = llm.withStructuredOutput(PlanSchema);
        const plan = await invokeWithRetry<z.infer<typeof PlanSchema>>(
          structuredLLM,
          [
            new SystemMessage(systemPrompt),
            new HumanMessage(taskPrompt)
          ],
          3
        );
        
        // Format and return result
        return JSON.stringify({
          ok: true,
          output: plan
        });
      } catch (error) {
        // Handle error
        const errorMessage = error instanceof Error ? error.message : String(error);
        return JSON.stringify(toolError(`Planning failed: ${errorMessage}`));
      }
    }
  });
}
