import { z } from 'zod'
import { Tool } from '../base/Tool'
import { AgentContext } from '../../core/AgentContext'

export const DoneParamsSchema = z.object({
  result: z.unknown(),  // The final result/output
  summary: z.string().optional()  // Optional summary of what was accomplished
})

export type DoneParams = z.infer<typeof DoneParamsSchema>

export class DoneTool extends Tool<DoneParams, void> {
  get definition() {
    return {
      name: 'done',
      description: 'Mark the task as complete with a final result',
      parameters: DoneParamsSchema,
      requiresApproval: false
    }
  }

  get promptTemplate(): string {
    return `Use this tool when you have successfully completed the task. Provide the final result and optionally a summary.`
  }

  protected async executeImpl(params: DoneParams, context: AgentContext): Promise<void> {
    // Store the final result in context
    context.set('finalResult', params.result)
    if (params.summary) {
      context.set('taskSummary', params.summary)
    }
    
    // Mark task as complete
    context.set('taskComplete', true)
  }
}