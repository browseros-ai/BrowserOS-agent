import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManagerReadOnly, MessageType } from '@/lib/runtime/MessageManager'
import { generateValidatorSystemPrompt, generateValidatorTaskPrompt } from './ValidatorTool.prompt'
import { toolError } from '@/lib/tools/Tool.interface'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { invokeWithRetry } from '@/lib/utils/retryable'
import { PubSub } from '@/lib/pubsub'
import { TokenCounter } from '@/lib/utils/TokenCounter'
import { Logging } from '@/lib/utils/Logging'

// Input schema
const ValidatorInputSchema = z.object({
  task: z.string()  // Original user task to validate
})

// Validation result schema for LLM structured output
const ValidationResultSchema = z.object({
  isComplete: z.boolean(),  // Whether the task is complete
  reasoning: z.string(),  // Explanation of validation result
  confidence: z.enum(['high', 'medium', 'low']),  // Confidence in validation
  suggestions: z.array(z.string())  // Suggestions for the planner if task incomplete
})

type ValidatorInput = z.infer<typeof ValidatorInputSchema>

// Factory function to create ValidatorTool
export function createValidatorTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'validator_tool',
    description: 'Validate if the task has been completed based on current browser state',
    schema: ValidatorInputSchema,
    func: async (args: ValidatorInput): Promise<string> => {
      try {
        executionContext.getPubSub().publishMessage(PubSub.createMessage(`Validating if the task is complete`, 'thinking'))
        // Get LLM instance
        const llm = await executionContext.getLLM()
        
        // Get browser state
        const browserStateString = await executionContext.browserContext.getBrowserStateString()
        
        // Get screenshot from the current page only if vision is enabled
        let screenshot = ''
        const config = executionContext.browserContext.getConfig()
        if (config.useVision) {
          try {
            const currentPage = await executionContext.browserContext.getCurrentPage()
            if (currentPage) {
              const screenshotBase64 = await currentPage.takeScreenshot()
              if (screenshotBase64) {
                screenshot = `data:image/jpeg;base64,${screenshotBase64}`
              }
            }
          } catch (error) {
            // Log but don't fail if screenshot capture fails
            console.warn('Failed to capture screenshot for validation:', error)
          }
        }
        
        // Get message history excluding initial system prompt and browser state messages  
        // to avoid token limit issues and provide only relevant context
        const readOnlyMessageManager = new MessageManagerReadOnly(executionContext.messageManager)
        const messageHistory = readOnlyMessageManager.getFilteredAsString([MessageType.SYSTEM, MessageType.BROWSER_STATE])
        
        // Generate prompts
        const systemPrompt = generateValidatorSystemPrompt()
        const taskPrompt = generateValidatorTaskPrompt(
          args.task,
          browserStateString,
          messageHistory,
          screenshot
        )
        
        // Prepare messages for LLM
        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(taskPrompt)
        ]
        
        // Log token count
        const tokenCount = TokenCounter.countMessages(messages)
        Logging.log('ValidatorTool', `Invoking LLM with ${TokenCounter.format(tokenCount)}`, 'info')
        
        // Get structured response from LLM with retry logic
        const structuredLLM = llm.withStructuredOutput(ValidationResultSchema)
        const validation = await invokeWithRetry<z.infer<typeof ValidationResultSchema>>(
          structuredLLM,
          messages,
          3
        )
        
        // Return standard tool output with validation data as JSON string
        const validationData = {
          isComplete: validation.isComplete,  // Include isComplete field
          reasoning: validation.reasoning,
          confidence: validation.confidence,
          suggestions: validation.suggestions
        }
        
        // Emit status message
        const status = validation.isComplete ? `Task completed!` : `Task is incomplete, will continue execution...`
        executionContext.getPubSub().publishMessage(PubSub.createMessage(status, 'thinking'))
        
        return JSON.stringify({
          ok: true,
          output: JSON.stringify(validationData)
        })
      } catch (error) {
        // Handle error
        const errorMessage = error instanceof Error ? error.message : String(error)
        executionContext.getPubSub().publishMessage(
          PubSub.createMessageWithId(PubSub.generateId('ToolError'), `Validation failed: ${errorMessage}`, 'error')
        )
        return JSON.stringify(toolError(errorMessage))  // Return raw error
      }
    }
  })
}
