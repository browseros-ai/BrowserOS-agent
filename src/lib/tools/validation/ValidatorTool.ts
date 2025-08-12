import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManagerReadOnly } from '@/lib/runtime/MessageManager'
import { generateValidatorSystemPrompt, generateValidatorTaskPrompt } from './ValidatorTool.prompt'
import { toolError } from '@/lib/tools/Tool.interface'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { invokeWithRetry } from '@/lib/utils/retryable'

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
        
        // Get message history for context
        const readOnlyMessageManager = new MessageManagerReadOnly(executionContext.messageManager)
        const messageHistory = readOnlyMessageManager.getAll()
          .map(m => `${m._getType()}: ${m.content}`)
          .join('\n')
        
        // Generate prompts
        const systemPrompt = generateValidatorSystemPrompt()
        const taskPrompt = generateValidatorTaskPrompt(
          args.task,
          browserStateString,
          messageHistory,
          screenshot
        )
        
        // Get structured response from LLM with retry logic
        const structuredLLM = llm.withStructuredOutput(ValidationResultSchema)
        const validation = await invokeWithRetry<z.infer<typeof ValidationResultSchema>>(
          structuredLLM,
          [
            new SystemMessage(systemPrompt),
            new HumanMessage(taskPrompt)
          ],
          3
        )
        
        // Return standard tool output with validation data as JSON string
        const validationData = {
          isComplete: validation.isComplete,  // Include isComplete field
          reasoning: validation.reasoning,
          confidence: validation.confidence,
          suggestions: validation.suggestions
        }
        
        return JSON.stringify({
          ok: true,
          output: JSON.stringify(validationData)
        })
      } catch (error) {
        // Handle error
        const errorMessage = error instanceof Error ? error.message : String(error)
        return JSON.stringify(toolError(`Validation failed: ${errorMessage}`))
      }
    }
  })
}
