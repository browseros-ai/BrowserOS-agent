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
import { BrowserStateChunker } from '@/lib/utils/BrowserStateChunker'
import { trimToMaxTokens } from '@/lib/utils/llmUtils'

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

// Helper function for chunked validation
async function _chunkedValidation(
  llm: any,
  args: ValidatorInput,
  browserStateString: string,
  messageHistory: string,
  screenshot: string,
  maxTokens: number,
  signal?: AbortSignal,
  executionContext?: ExecutionContext
): Promise<any> {
  const chunker = new BrowserStateChunker(browserStateString, maxTokens)
  const totalChunks = chunker.getTotalChunks()
  
  Logging.log('ValidatorTool', `Browser state too large, validating across ${totalChunks} chunks`, 'info')
  
  // Aggregate results
  let isComplete = false
  let reasoning = ''
  let confidence: 'high' | 'medium' | 'low' = 'low'
  let suggestions: string[] = []
  
  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunker.getChunk(i)
    if (!chunk) continue
    
    const chunkNote = `\n[VALIDATING CHUNK ${i + 1}/${totalChunks}]\n`
    
    const systemPrompt = generateValidatorSystemPrompt()
    let taskPrompt = generateValidatorTaskPrompt(
      args.task,
      chunk + chunkNote,
      messageHistory,
      i === 0 ? screenshot : ''  // Only include screenshot in first chunk
    )
    
    // Trim task prompt if executionContext is provided
    if (executionContext) {
      taskPrompt = trimToMaxTokens(taskPrompt, executionContext, 0.25)  // 25% reserve for structured output
    }
    
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(taskPrompt)
    ]
    
    const tokenCount = TokenCounter.countMessages(messages)
    Logging.log('ValidatorTool', `Validating chunk ${i + 1}/${totalChunks} with ${TokenCounter.format(tokenCount)}`, 'info')
    
    try {
      const structuredLLM = llm.withStructuredOutput(ValidationResultSchema)
      const validation = await invokeWithRetry<z.infer<typeof ValidationResultSchema>>(
        structuredLLM,
        messages,
        3,
        { signal }
      )
      
      // Update aggregated results
      isComplete = validation.isComplete
      reasoning += (reasoning ? ' | ' : '') + `Chunk ${i + 1}: ${validation.reasoning}`
      confidence = validation.confidence  // Take last chunk's confidence
      suggestions = suggestions.concat(validation.suggestions)
      
    } catch (error) {
      Logging.log('ValidatorTool', `Validation failed for chunk ${i + 1}: ${error}`, 'warning')
    }
  }
  
  return {
    isComplete,
    reasoning: reasoning || 'Validation across chunks',
    confidence,
    suggestions: [...new Set(suggestions)]  // Remove duplicates
  }
}

// Factory function to create ValidatorTool
const MIN_TOKENS_FOR_USING_VISION = 128000
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
        
        // Check if browser state needs chunking
        const maxTokens = executionContext.messageManager.getMaxTokens()
        const browserStateTokens = TokenCounter.countString(browserStateString)
        
        // Get screenshot only if vision is enabled AND model has enough tokens (>128K)
        let screenshot = ''
        const config = executionContext.browserContext.getConfig()
        
        if (config.useVision && maxTokens >= MIN_TOKENS_FOR_USING_VISION) {
          try {
            const currentPage = await executionContext.browserContext.getCurrentPage()
            if (currentPage) {
              const screenshotDataUrl = await currentPage.takeScreenshot()
              if (screenshotDataUrl) {
                screenshot = screenshotDataUrl  // Already a complete data URL
              }
            }
          } catch (error) {
            // Log but don't fail if screenshot capture fails
            console.warn('Failed to capture screenshot for validation:', error)
          }
        } else if (config.useVision && maxTokens < MIN_TOKENS_FOR_USING_VISION) {
          Logging.log('ValidatorTool', `Skipping vision - model token limit (${maxTokens}) is below ${MIN_TOKENS_FOR_USING_VISION}`, 'info')
        }
        
        // Get message history excluding initial system prompt and browser state messages  
        // to avoid token limit issues and provide only relevant context
        const readOnlyMessageManager = new MessageManagerReadOnly(executionContext.messageManager)
        const messageHistory = readOnlyMessageManager.getFilteredAsString([MessageType.SYSTEM, MessageType.BROWSER_STATE])
        
        let validationData: any
        
        if (browserStateTokens <= maxTokens) {
          // Single validation - existing logic
          const systemPrompt = generateValidatorSystemPrompt()
          let taskPrompt = generateValidatorTaskPrompt(
            args.task,
            browserStateString,
            messageHistory,
            screenshot
          )
          
          // Trim task prompt if it exceeds token limits
          taskPrompt = trimToMaxTokens(taskPrompt, executionContext, 0.25)  // 25% reserve for structured output
          
          const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(taskPrompt)
          ]
          
          const tokenCount = TokenCounter.countMessages(messages)
          Logging.log('ValidatorTool', `Invoking LLM with ${TokenCounter.format(tokenCount)}`, 'info')
          
          const structuredLLM = llm.withStructuredOutput(ValidationResultSchema)
          const validation = await invokeWithRetry<z.infer<typeof ValidationResultSchema>>(
            structuredLLM,
            messages,
            3,
            { signal: executionContext.abortController.signal }
          )
          
          validationData = {
            isComplete: validation.isComplete,
            reasoning: validation.reasoning,
            confidence: validation.confidence,
            suggestions: validation.suggestions
          }
        } else {
          // Multiple chunks needed
          validationData = await _chunkedValidation(
            llm,
            args,
            browserStateString,
            messageHistory,
            screenshot,
            maxTokens,
            executionContext.abortController.signal,
            executionContext
          )
        }
        
        // Emit status message
        const status = validationData.isComplete ? `Task completed!` : `Task is incomplete, will continue execution...`
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
