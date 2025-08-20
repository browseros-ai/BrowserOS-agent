import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { PubSub } from '@/lib/pubsub'

// Simple schema - just the prompt
const HumanInputSchema = z.object({
  prompt: z.string().describe('The situation requiring human intervention')
})

type HumanInputRequest = z.infer<typeof HumanInputSchema>

/**
 * Tool that pauses execution for human intervention
 * Returns immediately with a flag that triggers waiting in BrowserAgent
 */
export function createHumanInputTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'human_input_tool',
    description: `Request human intervention when stuck or need manual action.
Use this when:
- You need the human to manually complete a step (enter credentials, solve CAPTCHA, etc.)
- You're blocked and need the human to take over temporarily
- You encounter an error that requires human judgment

The human will either click "Done" (after taking action) or "Abort task" (to cancel).
After human input, re-planning will be triggered automatically.`,
    schema: HumanInputSchema,
    func: async (args: HumanInputRequest): Promise<string> => {
      try {
        // Generate unique request ID
        const requestId = PubSub.generateId('human_input')
        
        // Store request ID in execution context for later retrieval
        executionContext.setHumanInputRequestId(requestId)
        
        // Publish message to UI showing we're waiting
        const messageId = PubSub.generateId('human_input_msg')
        executionContext.getPubSub().publishMessage(
          PubSub.createMessageWithId(
            messageId,
            `⏸️ **Waiting for human input:** ${args.prompt}`,
            'thinking'
          )
        )
        
        // Publish special event for UI to show the dialog
        executionContext.getPubSub().publishHumanInputRequest({
          requestId,
          prompt: args.prompt
        })
        
        // Return immediately with special flag (like require_planning)
        return JSON.stringify({
          ok: true,
          output: `Waiting for human input: ${args.prompt}`,
          requiresHumanInput: true,  // Special flag for BrowserAgent
          requestId  // Include request ID for tracking
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return JSON.stringify({
          ok: false,
          output: errorMessage
        })
      }
    }
  })
}