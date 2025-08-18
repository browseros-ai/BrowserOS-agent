import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { PubSub } from '@/lib/pubsub'

// Schema for the require planning tool
const RequirePlanningInputSchema = z.object({
  reason: z.string().describe('Why re-planning is needed (e.g., "Current TODOs complete", "Stuck on current task", "Need different approach")')
})

type RequirePlanningInput = z.infer<typeof RequirePlanningInputSchema>

/**
 * Tool that allows the agent to explicitly request re-planning
 * Used when current TODOs are insufficient or a new approach is needed
 */
export function createRequirePlanningTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'require_planning_tool',
    description: `Request a new plan when:
- All current TODOs are complete but task isn't done
- Current approach is not working and you need a different strategy
- You're stuck and need fresh planning
- TODOs are insufficient to complete the user's task
DO NOT use this for simple failures - try alternative approaches first.`,
    schema: RequirePlanningInputSchema,
    func: async (args: RequirePlanningInput): Promise<string> => {
      try {
        // Publish the re-planning request to UI
        const messageId = PubSub.generateId('require_planning')
        executionContext.getPubSub().publishMessage(
          PubSub.createMessageWithId(
            messageId,
            `Re-planning requested: ${args.reason}`,
            'thinking'
          )
        )
        
        return JSON.stringify({
          ok: true,
          output: `Re-planning requested: ${args.reason}`,
          requiresPlanning: true  // Special flag for BrowserAgent
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