import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManagerReadOnly, MessageType } from '@/lib/runtime/MessageManager'
import { toolSuccess, toolError } from '@/lib/tools/Tool.interface'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { 
  buildClassificationSystemPrompt,
  buildClassificationTaskPrompt
} from '@/lib/tools/classification/classification.tool.prompt'
import { PubSub } from '@/lib/pubsub'
import { invokeWithRetry } from '@/lib/utils/retryable'
import { TokenCounter } from '@/lib/utils/TokenCounter'
import { Logging } from '@/lib/utils/Logging'

// Constants
const MAX_RECENT_MESSAGES = 10  // Number of recent messages to analyze

// Input schema - just the task
export const ClassificationInputSchema = z.object({
  task: z.string(),  // Task to classify
})

export type ClassificationInput = z.infer<typeof ClassificationInputSchema>

// Output schema for classification result
const ClassificationResultSchema = z.object({
  is_simple_task: z.boolean(),  // True if task can be done without planning
  is_followup_task: z.boolean(),  // True if task continues from previous context
})

type ClassificationResult = z.infer<typeof ClassificationResultSchema>

export class ClassificationTool {
  constructor(
    private executionContext: ExecutionContext,
    private toolDescriptions: string
  ) {}

  async execute(input: ClassificationInput): Promise<string> {
    try {
      this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Classifying task...`, 'thinking'))
      // Get LLM instance
      const llm = await this.executionContext.getLLM()
      
      // Get recent message history, excluding system prompts and browser state messages
      // to focus on actual conversation context
      const reader = new MessageManagerReadOnly(this.executionContext.messageManager)
      const filteredMessages = reader.getFiltered([MessageType.SYSTEM, MessageType.BROWSER_STATE])
      const recentMessages = filteredMessages.slice(-MAX_RECENT_MESSAGES)
      
      // Build prompt
      const systemPrompt = this._buildSystemPrompt()
      const taskPrompt = this._buildTaskPrompt(input.task, recentMessages)
      
      // Log token count
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(taskPrompt)
      ]
      const tokenCount = TokenCounter.countMessages(messages)
      Logging.log('ClassificationTool', `Invoking LLM with ${TokenCounter.format(tokenCount)}`, 'info')
      
      // Call LLM with structured output and retry logic
      const structuredLLM = llm.withStructuredOutput(ClassificationResultSchema)
      const result = await invokeWithRetry<ClassificationResult>(
        structuredLLM,
        messages,
        3,
        { signal: this.executionContext.abortSignal }
      )
      this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Task classified as ${result.is_simple_task ? 'simple' : 'complex'} and ${result.is_followup_task ? 'follow-up' : 'new'}`, 'thinking'))
      
      return JSON.stringify(toolSuccess(JSON.stringify(result)))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.executionContext.getPubSub().publishMessage(
        PubSub.createMessageWithId(PubSub.generateId('ToolError'), `Classification failed: ${errorMessage}`, 'error')
      )
      return JSON.stringify(toolError(errorMessage))  // Return raw error
    }
  }

  private _buildSystemPrompt(): string {
    return buildClassificationSystemPrompt(this.toolDescriptions)
  }

  private _buildTaskPrompt(task: string, recentMessages: any[]): string {
    const messageHistory = recentMessages
      .map(m => `${m._getType()}: ${m.content}`)
      .join('\n')
    
    return buildClassificationTaskPrompt(task, messageHistory)
  }
}

// Factory function
export function createClassificationTool(
  executionContext: ExecutionContext,
  toolDescriptions: string
): DynamicStructuredTool {
  const classificationTool = new ClassificationTool(executionContext, toolDescriptions)
  
  return new DynamicStructuredTool({
    name: 'classification_tool',
    description: 'Classify whether a task is simple/complex and new/follow-up',
    schema: ClassificationInputSchema,
    func: async (args: ClassificationInput): Promise<string> => {
      return await classificationTool.execute(args)
    }
  })
}
