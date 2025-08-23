import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/Tool.interface"
import { findElementPrompt } from "./FindElementTool.prompt"
import { invokeWithRetry } from "@/lib/utils/retryable"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { PubSub } from "@/lib/pubsub"
import { TokenCounter } from "@/lib/utils/TokenCounter"
import { Logging } from "@/lib/utils/Logging"
import { BrowserStateChunker } from "@/lib/utils/BrowserStateChunker"

// Constants
const INTERACTION_WAIT_MS = 1000
const NUM_RETRIES = 1
const RETRY_WAIT_MS = 500

// Input schema for interaction operations
export const InteractionInputSchema = z.object({
  operationType: z.enum(["click", "input_text", "clear", "send_keys"]),  // Operation to perform
  description: z.string().optional(),  // Natural language description of element
  input_text: z.string().optional(),  // Text for input_text operation
  select_option: z.string().optional(),  // Option for select operation (not used yet)
  keys: z.string().optional(),  // Keys for send_keys operation
})

export type InteractionInput = z.infer<typeof InteractionInputSchema>

// Schema for LLM structured output (copied from FindElementTool)
const _FindElementSchema = z.object({
  found: z.boolean().describe("Whether a matching element was found"),
  index: z.number().nullable().describe("The index number of the best matching element (null if not found)"),
  confidence: z.enum(["high", "medium", "low"]).nullable().describe("Confidence level in the match (null if not found)"),
  reasoning: z.string().describe("Brief explanation of the decision"),
})

export class InteractionTool {
  constructor(
    private executionContext: ExecutionContext
  ) {}

  async execute(input: InteractionInput): Promise<ToolOutput> {
    // Route to appropriate method based on operation type
    switch (input.operationType) {
      case "click":
        if (!input.description) {
          return toolError("click operation requires description parameter")
        }
        return await this._clickElement(input.description)
        
      case "input_text":
        if (!input.description || !input.input_text) {
          return toolError("input_text operation requires description and input_text parameters")
        }
        return await this._inputTextElement(input.description, input.input_text)
        
      case "clear":
        if (!input.description) {
          return toolError("clear operation requires description parameter")
        }
        return await this._clearElement(input.description)
        
      case "send_keys":
        if (!input.keys) {
          return toolError("send_keys operation requires keys parameter")
        }
        return await this._sendKeys(input.keys)
        
      default:
        return toolError(`Unknown operation: ${input.operationType}`)
    }
  }

  // Find element using LLM (adapted from FindElementTool)
  private async _findElementWithLLM(description: string): Promise<z.infer<typeof _FindElementSchema>> {
    // Get max tokens from MessageManager (which gets it from model capabilities)
    const _MAX_TOKENS_PER_CHUNK = this.executionContext.messageManager.getMaxTokens();
    const currentTask = this.executionContext.getCurrentTask()

    let baseUserMessage = `Find the element matching this description: "${description}"`
    if (currentTask) {
      baseUserMessage = `User's goal: ${currentTask}\n\n${baseUserMessage}`
    }
    
    // Get browser state
    const browserState = await this.executionContext.browserContext.getBrowserState()
    if (!browserState.clickableElements.length && !browserState.typeableElements.length) {
      throw new Error("No interactive elements found on the current page")
    }
    
    // Get full browser state string and chunk it
    const browserStateString = await this.executionContext.browserContext.getBrowserStateString(true); // simplified=true
    const chunker = new BrowserStateChunker(browserStateString, _MAX_TOKENS_PER_CHUNK);
    const totalChunks = chunker.getTotalChunks();
    
    // If single chunk, simple case
    if (totalChunks === 1) {
      const userMessage = baseUserMessage + `\n\nInteractive elements on the page:\n${chunker.getChunk(0)}`;
      
      const messages = [
        new SystemMessage(findElementPrompt),
        new HumanMessage(userMessage)
      ];
      
      const tokenCount = TokenCounter.countMessages(messages);
      Logging.log('InteractionTool', `Invoking LLM with ${TokenCounter.format(tokenCount)}`, 'info');
      
      const llm = await this.executionContext.getLLM();
      const structuredLLM = llm.withStructuredOutput(_FindElementSchema);
      return await invokeWithRetry<z.infer<typeof _FindElementSchema>>(
        structuredLLM,
        messages,
        3,
        { signal: this.executionContext.abortController.signal }
      );
    }
    
    // Multiple chunks - search through each
    Logging.log('InteractionTool', `Searching through ${totalChunks} chunks for element`, 'info');
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunker.getChunk(i);
      if (!chunk) continue;
      
      const userMessage = baseUserMessage + 
        `\n\nNOTE: This is chunk ${i + 1} of ${totalChunks}. ` +
        `The element may not be in this chunk - if not found, return found=false.\n\n` +
        `Interactive elements:\n${chunk}`;
      
      const messages = [
        new SystemMessage(findElementPrompt),
        new HumanMessage(userMessage)
      ];
      
      const tokenCount = TokenCounter.countMessages(messages);
      Logging.log('InteractionTool', `Searching chunk ${i + 1}/${totalChunks} with ${TokenCounter.format(tokenCount)}`, 'info');
      
      const llm = await this.executionContext.getLLM();
      const structuredLLM = llm.withStructuredOutput(_FindElementSchema);
      const result = await invokeWithRetry<z.infer<typeof _FindElementSchema>>(
        structuredLLM,
        messages,
        3,
        { signal: this.executionContext.abortController.signal }
      );
      
      // If found, return immediately
      if (result.found && result.index !== null) {
        Logging.log('InteractionTool', `Element found in chunk ${i + 1}/${totalChunks}`, 'info');
        return result;
      }
    }
    
    // Not found in any chunk
    return {
      found: false,
      index: null,
      confidence: null,
      reasoning: `Element "${description}" not found after searching all ${totalChunks} chunks`
    };
  }

  // Updated find element with type checking
  private async _findElement(description: string, interactionType: 'click' | 'type'): Promise<number> {
    const result = await this._findElementWithLLM(description)
    
    if (!result.found || result.index === null) {
      throw new Error(result.reasoning || `No element found matching "${description}"`)
    }
    
    // Verify element exists and is appropriate type
    const browserState = await this.executionContext.browserContext.getBrowserState()
    const isClickable = interactionType === 'click'
    const elements = isClickable ? browserState.clickableElements : browserState.typeableElements
    
    const found = elements.find(el => el.nodeId === result.index)
    
    if (!found) {
      throw new Error(`Invalid index ${result.index} returned - element not found or wrong type for ${interactionType}`)
    }
    
    return result.index
  }

  // Click element with retry logic
  private async _clickElement(description: string): Promise<ToolOutput> {
    this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Finding element to click with description: ${description}`, 'thinking'))

    for (let attempt = 1; attempt <= NUM_RETRIES; attempt++) {
      try {
        // Find element (returns nodeId)
        const nodeId = await this._findElement(description, 'click')
        
        // Get element and click
        const page = await this.executionContext.browserContext.getCurrentPage()
        const element = await page.getElementByIndex(nodeId)
        
        if (!element) {
          throw new Error(`Element with nodeId ${nodeId} not found`)
        }

        // Check for file uploader
        if (page.isFileUploader(element)) {
          return toolError(`Element "${description}" opens a file upload dialog. File uploads are not supported.`)
        }

        // Click element
        await page.clickElement(nodeId)
        await new Promise(resolve => setTimeout(resolve, INTERACTION_WAIT_MS))
        
        // Emit status message
        this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Clicked element: ${description}`, 'thinking'))
        return toolSuccess(`Clicked element: "${description}"`)
        
      } catch (error) {
        if (attempt === NUM_RETRIES) {
          return toolError(error instanceof Error ? error.message : String(error))  // Return raw error
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_MS))
      }
    }
    return toolError(`Failed to click "${description}" after ${NUM_RETRIES} attempts`)
  }

  // Input text with retry logic
  private async _inputTextElement(description: string, text: string): Promise<ToolOutput> {
    this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Finding element to type into with description: ${description}`, 'thinking'))

    for (let attempt = 1; attempt <= NUM_RETRIES; attempt++) {
      try {
        // Find element (returns nodeId)
        const nodeId = await this._findElement(description, 'type')
        
        // Get element and input text
        const page = await this.executionContext.browserContext.getCurrentPage()
        const element = await page.getElementByIndex(nodeId)
        
        if (!element) {
          throw new Error(`Element with nodeId ${nodeId} not found`)
        }

        // Clear and input text
        await page.clearElement(nodeId)
        await page.inputText(nodeId, text)
        await new Promise(resolve => setTimeout(resolve, INTERACTION_WAIT_MS))
        
        // Emit status message
        this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Typed "${text}" into ${description}`, 'thinking'))
        
        return toolSuccess(`Typed "${text}" into "${description}"`)
        
      } catch (error) {
        if (attempt === NUM_RETRIES) {
          return toolError(error instanceof Error ? error.message : String(error))  // Return raw error
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_MS))
      }
    }
    return toolError(`Failed to input text into "${description}" after ${NUM_RETRIES} attempts`)
  }

  // Clear element with retry logic
  private async _clearElement(description: string): Promise<ToolOutput> {
    for (let attempt = 1; attempt <= NUM_RETRIES; attempt++) {
      try {
        this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Finding element to clear with description: ${description}`, 'thinking'))
        // Find element (returns nodeId)
        const nodeId = await this._findElement(description, 'type')
        
        // Get element and clear
        const page = await this.executionContext.browserContext.getCurrentPage()
        const element = await page.getElementByIndex(nodeId)
        
        if (!element) {
          throw new Error(`Element with nodeId ${nodeId} not found`)
        }

        // Clear element
        await page.clearElement(nodeId)
        await new Promise(resolve => setTimeout(resolve, INTERACTION_WAIT_MS))
        
        // Emit status message
        this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Cleared: ${description}`, 'thinking'))
        
        return toolSuccess(`Cleared element: "${description}"`)
        
      } catch (error) {
        if (attempt === NUM_RETRIES) {
          return toolError(error instanceof Error ? error.message : String(error))  // Return raw error
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_MS))
      }
    }
    return toolError(`Failed to clear "${description}" after ${NUM_RETRIES} attempts`)
  }

  private async _sendKeys(keys: string): Promise<ToolOutput> {
    this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Sending keys: ${keys}`, 'thinking'))
    const page = await this.executionContext.browserContext.getCurrentPage()
    await page.sendKeys(keys)
    
    // Emit status message
    this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Sent keys: ${keys}`, 'thinking'))
    
    return toolSuccess(`Sent keys: ${keys}`)
  }
}

// LangChain wrapper factory function
export function createInteractionTool(
  executionContext: ExecutionContext
): DynamicStructuredTool {
  const interactionTool = new InteractionTool(executionContext)
  
  return new DynamicStructuredTool({
    name: "interact_tool",
    description: `Interact with page elements by describing them in natural language. This tool automatically finds and interacts with elements in a single step.

IMPORTANT: You do NOT need to find elements first - this tool handles both finding and interacting.

Operations:
- click: Click on an element
- input_text: Type text into an input field  
- clear: Clear the contents of a field
- send_keys: Send keyboard keys (like Enter, Tab, etc.)

Examples:
- Click button: { operationType: "click", description: "Submit button" }
- Fill input: { operationType: "input_text", description: "email field", input_text: "user@example.com" }
- Clear field: { operationType: "clear", description: "search box" }
- Press key: { operationType: "send_keys", keys: "Enter" }

The tool uses AI to find the best matching element based on your description, then performs the action.`,
    schema: InteractionInputSchema,
    func: async (args): Promise<string> => {
      const result = await interactionTool.execute(args)
      return JSON.stringify(result)
    }
  })
}
