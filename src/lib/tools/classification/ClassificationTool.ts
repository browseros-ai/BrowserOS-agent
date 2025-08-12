import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManagerReadOnly } from '@/lib/runtime/MessageManager'
import { toolSuccess, toolError } from '@/lib/tools/Tool.interface'
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages'
import { 
  buildClassificationSystemPrompt,
  buildClassificationTaskPrompt
} from '@/lib/tools/classification/classification.tool.prompt'
import { invokeWithRetry } from '@/lib/utils/retryable'

// Constants
const MAX_RECENT_MESSAGES = 10  // Number of recent messages to analyze
const SYSTEM_CONTEXT_MARK = '<system-context>' as const  // filter marker
const SYSTEM_REMINDER_MARK = '<system-reminder>' as const  // filter marker

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
      // Get LLM instance
      const llm = await this.executionContext.getLLM()
      
      // Get recent message history
      const reader = new MessageManagerReadOnly(this.executionContext.messageManager)
      const recentMessages = reader.getAll().slice(-MAX_RECENT_MESSAGES)
      
      // Build prompt
      const systemPrompt = this._buildSystemPrompt()
      const taskPrompt = this._buildTaskPrompt(input.task, recentMessages)
      
      // Call LLM with structured output and retry logic
      const structuredLLM = llm.withStructuredOutput(ClassificationResultSchema)
      const result = await invokeWithRetry<ClassificationResult>(
        structuredLLM,
        [
          new SystemMessage(systemPrompt),
          new HumanMessage(taskPrompt)
        ],
        3
      )
      
      return JSON.stringify(toolSuccess(JSON.stringify(result)))
    } catch (error) {
      return JSON.stringify(toolError(`Classification failed: ${error instanceof Error ? error.message : String(error)}`))
    }
  }

  private _buildSystemPrompt(): string {
    return buildClassificationSystemPrompt(this.toolDescriptions)
  }

  private _buildTaskPrompt(task: string, recentMessages: readonly BaseMessage[]): string {
    // Use only human/assistant natural-language messages for context, exclude system/tool/browser-state noise
    const filteredMessages = recentMessages.filter((message: BaseMessage) => {
      const type: string = this._getMessageType(message)
      if (type === 'human') return true
      if (type === 'ai') {
        const text: string = this._getMessageContent(message)
        return text && !text.includes(SYSTEM_CONTEXT_MARK) && !text.includes(SYSTEM_REMINDER_MARK)
      }
      return false
    })
    const relevantMessages = filteredMessages.slice(-MAX_RECENT_MESSAGES)
    const messageHistoryText: string = relevantMessages
      .map((message: BaseMessage) => `${this._getMessageType(message)}: ${this._getMessageContent(message)}`)
      .join('\n')
    return buildClassificationTaskPrompt(task, messageHistoryText)
  }

  private _getMessageType(message: BaseMessage): string {
    return this._hasGetType(message) ? message._getType() : ''
  }

  private _getMessageContent(message: BaseMessage): string {
    // LangChain BaseMessage content can be string or array of content parts
    const content: unknown = (message as unknown as { content?: unknown }).content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      // Merge content parts into a single text string when possible
      const parts: unknown[] = content
      return parts
        .map((part: unknown) => {
          const maybeText = (part as { text?: unknown }).text
          return typeof maybeText === 'string' ? maybeText : ''
        })
        .join(' ')
        .trim()
    }
    return ''
  }

  private _hasGetType (message: BaseMessage): message is BaseMessage & { _getType: () => string } {
    return typeof (message as unknown as { _getType?: unknown })._getType === 'function'
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