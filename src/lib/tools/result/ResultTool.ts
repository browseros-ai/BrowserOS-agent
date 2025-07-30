import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { MessageManagerReadOnly } from '@/lib/runtime/MessageManager';
import { generateResultSystemPrompt, generateResultTaskPrompt } from './ResultTool.prompt';
import { toolError } from '@/lib/tools/Tool.interface';
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';

// Input schema - simple
const ResultInputSchema = z.object({
  task: z.string(),  // Original user task
});

// Result schema for LLM structured output
const ResultSummarySchema = z.object({
  success: z.boolean(),  // true for success, false for failed
  message: z.string()  // Markdown-formatted result
});

type ResultInput = z.infer<typeof ResultInputSchema>;

// Factory function to create ResultTool
export function createResultTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'result_tool',
    description: 'Generate a clear, concise summary of task execution results',
    schema: ResultInputSchema,
    func: async (args: ResultInput): Promise<string> => {
      try {
        // Get LLM instance from execution context
        const llm = await executionContext.getLLM({temperature: 0.3});
        
        // Get message history - filter to only tool messages
        const readOnlyMessageManager = new MessageManagerReadOnly(executionContext.messageManager);
        const messageHistory = readOnlyMessageManager.getAll()
          .filter(m => m instanceof ToolMessage)
          .map(m => m.content)
          .join('\n');
       
        // Get browser state
        const browserState = await executionContext.browserContext.getBrowserStateString();
        
        // Generate prompts
        const systemPrompt = generateResultSystemPrompt();
        const taskPrompt = generateResultTaskPrompt(
          args.task,
          messageHistory,
          browserState
        );
        
        // Get structured response from LLM
        const structuredLLM = llm.withStructuredOutput(ResultSummarySchema);
        const result = await structuredLLM.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(taskPrompt)
        ]);
        
        // Format and return result
        return JSON.stringify({
          ok: true,
          output: result
        });
      } catch (error) {
        // Handle error
        const errorMessage = error instanceof Error ? error.message : String(error);
        return JSON.stringify(toolError(`Result generation failed: ${errorMessage}`));
      }
    }
  });
}
