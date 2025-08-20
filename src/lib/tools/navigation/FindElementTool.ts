import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/Tool.interface"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { findElementPrompt } from "./FindElementTool.prompt"
import { invokeWithRetry } from "@/lib/utils/retryable"
import { PubSub } from "@/lib/pubsub"
import { TokenCounter } from "@/lib/utils/TokenCounter"
import { Logging } from "@/lib/utils/Logging"

// Input schema for find element operations
export const FindElementInputSchema = z.object({
  elementDescription: z.string(),  // Natural language description of element
  intent: z.string().optional(),  // Optional context about why finding this element
})

export type FindElementInput = z.infer<typeof FindElementInputSchema>

// Schema for LLM structured output
const FindElementLLMSchema = z.object({
  found: z.boolean().describe("Whether a matching element was found"),
  index: z.number().nullable().describe("The index number of the best matching element (null if not found)"),
  confidence: z.enum(["high", "medium", "low"]).nullable().describe("Confidence level in the match (null if not found)"),
  reasoning: z.string().describe("Brief explanation of the decision"),
})

export class FindElementTool {
  constructor(private executionContext: ExecutionContext) { }

  async execute(input: FindElementInput): Promise<ToolOutput> {
    try {
      this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Finding element...`, 'thinking'))
      // Get browser state
      const browserState = await this.executionContext.browserContext.getBrowserState()

      if (!browserState.clickableElements.length && !browserState.typeableElements.length) {
        return toolError("No interactive elements found on the current page")
      }

      // Get current task from execution context
      const currentTask = this.executionContext.getCurrentTask()

      // Find element using LLM
      const result = await this._findElementWithLLM(
        input.elementDescription,
        browserState.clickableElementsString + '\n' + browserState.typeableElementsString,
        currentTask
      )

      if (!result.found || result.index === null) {
        return toolError(result.reasoning || `No element found matching "${input.elementDescription}"`)
      }

      // TODO(NTN): Ideally this find element tool can have it's own message manager and if it doesn't find the element
      // you can quicly do a retry and see if it finds element again.
      // Verify element exists
      const foundInClickable = browserState.clickableElements.find(el => el.nodeId === result.index)
      const foundInTypeable = browserState.typeableElements.find(el => el.nodeId === result.index)

      if (!foundInClickable && !foundInTypeable) {
        return toolError(`Invalid index ${result.index} returned - element not found`)
      }
      
      this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Found element at index: ${result.index}`, 'thinking'))

      // Return the LLM result directly
      return toolSuccess(JSON.stringify(result))
    } catch (error) {
      return toolError(`Failed to find element: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async _findElementWithLLM(description: string, domContent: string, currentTask: string | null) {
    // Get LLM with low temperature for consistency
    // Get LLM instance from execution context
    const llm = await this.executionContext.getLLM();

    // Create structured LLM
    const structuredLLM = llm.withStructuredOutput(FindElementLLMSchema)

    // Build user message with task context if available
    let userMessage = `Find the element matching this description: "${description}"`
    
    if (currentTask) {
      userMessage = `User's goal: ${currentTask}\n\n${userMessage}`
    }
    
    userMessage += `\n\nInteractive elements on the page:\n${domContent}`

    // Prepare messages for LLM
    const messages = [
      new SystemMessage(findElementPrompt),
      new HumanMessage(userMessage)
    ]
    
    // Log token count
    const tokenCount = TokenCounter.countMessages(messages)
    Logging.log('FindElementTool', `Invoking LLM with ${TokenCounter.format(tokenCount)}`, 'info')
    
    // Invoke LLM with retry logic
    const result = await invokeWithRetry<z.infer<typeof FindElementLLMSchema>>(
      structuredLLM,
      messages,
      3,
      { signal: this.executionContext.abortController.signal }
    )

    return result
  }
}

// LangChain wrapper factory function
export function createFindElementTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const findElementTool = new FindElementTool(executionContext)

  return new DynamicStructuredTool({
    name: "find_element_tool",
    description: "Find an element on the page using a natural language description. Returns found (boolean), index (number), confidence level, and reasoning.",
    schema: FindElementInputSchema,
    func: async (args): Promise<string> => {
      const result = await findElementTool.execute(args)
      return JSON.stringify(result)
    }
  })
}
