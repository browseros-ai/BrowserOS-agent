import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { MessageManagerReadOnly, MessageType } from '@/lib/runtime/MessageManager';
import { generateResultSystemPrompt, generateResultTaskPrompt } from './ResultTool.prompt';
import { toolError } from '@/lib/tools/Tool.interface';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { invokeWithRetry } from '@/lib/utils/retryable';
import { PubSub } from '@/lib/pubsub';
import { TokenCounter } from '@/lib/utils/TokenCounter';
import { Logging } from '@/lib/utils/Logging';

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
        executionContext.getPubSub().publishMessage(PubSub.createMessage(`Generating result for task: ${args.task} after execution`, 'thinking'));
        const llm = await executionContext.getLLM({temperature: 0.3});
        
        // Get only tool messages for the result summary
        // We exclude all message types except TOOL to focus on execution results
        const readOnlyMessageManager = new MessageManagerReadOnly(executionContext.messageManager);
        const toolMessages = readOnlyMessageManager.getFiltered([
          MessageType.SYSTEM, 
          MessageType.HUMAN, 
          MessageType.BROWSER_STATE
        ]);
        const messageHistory = toolMessages
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
        
        // Prepare messages for LLM
        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(taskPrompt)
        ];
        
        // Log token count
        const tokenCount = TokenCounter.countMessages(messages);
        Logging.log('ResultTool', `Invoking LLM with ${TokenCounter.format(tokenCount)}`, 'info');
        
        // Get structured response from LLM with retry logic
        const structuredLLM = llm.withStructuredOutput(ResultSummarySchema);
        const result = await invokeWithRetry<z.infer<typeof ResultSummarySchema>>(
          structuredLLM,
          messages,
          3,
          { signal: executionContext.abortController.signal }
        );
        
        executionContext.getPubSub().publishMessage(PubSub.createMessage(`Generated result for task: ${args.task}`, 'thinking'))
        
        // Format and return result
        return JSON.stringify({
          ok: true,
          output: result
        });
      } catch (error) {
        // Handle error
        const errorMessage = error instanceof Error ? error.message : String(error);
        executionContext.getPubSub().publishMessage(
          PubSub.createMessageWithId(PubSub.generateId('ToolError'), `Result generation failed: ${errorMessage}`, 'error')
        );
        return JSON.stringify(toolError(errorMessage));  // Return raw error
      }
    }
  });
}
