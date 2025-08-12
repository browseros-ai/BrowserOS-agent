import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/Tool.interface"
import { findElementPrompt } from "./FindElementTool.prompt"
import { invokeWithRetry } from "@/lib/utils/retryable"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"

// Constants
const INTERACTION_WAIT_MS = 1000
const NUM_RETRIES = 2
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
    // Get LLM instance from execution context
    const llm = await this.executionContext.getLLM();

    // Create structured LLM
    const structuredLLM = llm.withStructuredOutput(_FindElementSchema)

    // Get current task from execution context
    const currentTask = this.executionContext.getCurrentTask()

    // Build user message with task context if available
    let userMessage = `Find the element matching this description: "${description}"`
    
    if (currentTask) {
      userMessage = `User's goal: ${currentTask}\n\n${userMessage}`
    }
    
    // Get browser state
    const browserState = await this.executionContext.browserContext.getBrowserState()

    if (!browserState.clickableElements.length && !browserState.typeableElements.length) {
      throw new Error("No interactive elements found on the current page")
    }

    // Filter out previously failed URLs from clickable elements list
    const failedUrls = this.executionContext.getFailedUrls().map(u => u.toLowerCase())
    const triedNodeIds = this.executionContext.getTriedNodeIds(browserState.url, description)
    // Helper: extract href value (raw and decoded), and Google q= param if present
    const extractHrefData = (line: string): { raw?: string; decoded?: string; q?: string } => {
      try {
        const attrMatch = line.match(/attr:"([^"]+)"/)
        if (!attrMatch || !attrMatch[1]) return {}
        const attrs = attrMatch[1]
        const hrefPair = attrs.split(' ').find(kv => kv.startsWith('href='))
        if (!hrefPair) return {}
        const raw = hrefPair.slice('href='.length)
        let decoded: string | undefined
        try { decoded = decodeURIComponent(raw) } catch (e) { decoded = raw }
        let qVal: string | undefined
        try {
          const u = new URL(decoded || raw, browserState.url)
          const q = u.searchParams.get('q')
          if (q) {
            try { qVal = decodeURIComponent(q) } catch { qVal = q }
          }
        } catch (_e) { /* ignore decode errors */ }
        return { raw, decoded, q: qVal }
      } catch (_e) { return {} }
    }

    // Build failed tokens for robust matching (handles encoding and host-only matches)
    const failedTokens: string[] = []
    for (const f of failedUrls) {
      failedTokens.push(f)
      try {
        failedTokens.push(encodeURIComponent(f))
      } catch (_e) { /* ignore URL parse */ }
      try {
        const u = new URL(f)
        failedTokens.push(u.hostname)
        if (u.pathname) failedTokens.push(u.pathname)
        const m = u.pathname.match(new RegExp('/(?:pdf|abs)/([^/?#]+)'))
        if (m && m[1]) failedTokens.push(m[1].toLowerCase())
      } catch (_e) { /* ignore */ }
    }

    let filteredLines = browserState.clickableElementsString
      .split('\n')
      .filter(line => !!line)

    // Basic URL filter
    if (failedUrls.length > 0) {
      filteredLines = filteredLines.filter(line => {
        const lower = line.toLowerCase()
        const href = extractHrefData(line)
        const enrich = [
          lower,
          href.raw ? href.raw.toLowerCase() : '',
          href.decoded ? href.decoded.toLowerCase() : '',
          href.q ? href.q.toLowerCase() : ''
        ].join(' ')
        return !failedTokens.some(tok => tok && enrich.includes(tok))
      })
    }

    // Tried nodeIds filter
    if (triedNodeIds.size > 0) {
      filteredLines = filteredLines.filter(line => {
        const m = line.match(/\[(\d+)\]/)
        if (!m || !m[1]) return true
        const id = parseInt(m[1], 10)
        return !triedNodeIds.has(id)
      })
    }

    const filteredClickable = filteredLines.join('\n')

    if (failedUrls.length > 0) {
      userMessage += `\n\nAvoid revisiting previously failed targets. Do NOT select any element whose URL or destination matches any of these (including encoded variants, hosts, or IDs):\n${failedUrls.join('\n')}`
    }
    
    userMessage += `\n\nInteractive elements on the page:\n${filteredClickable}\n${browserState.typeableElementsString}`

    // Invoke LLM with retry logic
    const result = await invokeWithRetry<z.infer<typeof _FindElementSchema>>(
      structuredLLM,
      [
        new SystemMessage(findElementPrompt),
        new HumanMessage(userMessage)
      ],
      3
    )

    return result
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

    // Guard: if the element line contains a failed URL, reject so retry can pick next best
    try {
      if (isClickable) {
        const failedUrls = this.executionContext.getFailedUrls().map(u => u.toLowerCase())
        const line = browserState.clickableElementsString
          .split('\n')
          .find(l => l.includes(`[${result.index}]`)) || ''
        if (failedUrls.some(f => line.toLowerCase().includes(f))) {
          throw new Error('Selected element matches a previously failed URL; picking a different option')
        }
      }
    } catch (_e) { /* ignore guard */ }
    
    // Record this selection as tried for this page+description
    try {
      this.executionContext.markTriedElement(browserState.url, description, result.index)
    } catch (_e) { /* ignore */ }
    return result.index
  }

  // Click element with retry logic
  private async _clickElement(description: string): Promise<ToolOutput> {
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

        // Final guard: avoid clicking elements that lead to previously failed targets
        try {
          const failed = this.executionContext.getFailedUrls().map(u => u.toLowerCase())
          if (failed.length > 0) {
            const attrs: any = (element as any)?.attributes || {}
            const rawHref: string | undefined = attrs['href']
            const currentUrl = page.url()
            let resolvedHref: string | undefined
            if (rawHref) {
              try { resolvedHref = new URL(rawHref, currentUrl).toString() } catch (_e) { resolvedHref = rawHref }
            }
            const tokens: string[] = []
            for (const f of failed) {
              tokens.push(f)
              try { tokens.push(encodeURIComponent(f)) } catch (_e) { /* ignore */ }
              try {
                const u = new URL(f)
                tokens.push(u.hostname)
                if (u.pathname) tokens.push(u.pathname)
                const m = u.pathname.match(new RegExp('/(?:pdf|abs)/([^/?#]+)'))
                if (m && m[1]) tokens.push(m[1].toLowerCase())
              } catch (_e) { /* ignore */ }
            }
            const haystack = [rawHref || '', resolvedHref || ''].map(s => s.toLowerCase()).join(' ')
            if (haystack && tokens.some(tok => tok && haystack.includes(tok))) {
              throw new Error('Target link matches a previously failed URL; selecting a different option')
            }
          }
        } catch (_e) { /* ignore */ }

        // Click element
        await page.clickElement(nodeId)
        await new Promise(resolve => setTimeout(resolve, INTERACTION_WAIT_MS))
        return toolSuccess(`Clicked element: "${description}"`)
        
      } catch (error) {
        if (attempt === NUM_RETRIES) {
          return toolError(`Failed to click "${description}": ${error instanceof Error ? error.message : String(error)}`)
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_MS))
      }
    }
    return toolError(`Failed to click "${description}" after ${NUM_RETRIES} attempts`)
  }

  // Input text with retry logic
  private async _inputTextElement(description: string, text: string): Promise<ToolOutput> {
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
        return toolSuccess(`Typed "${text}" into "${description}"`)
        
      } catch (error) {
        if (attempt === NUM_RETRIES) {
          return toolError(`Failed to input text into "${description}": ${error instanceof Error ? error.message : String(error)}`)
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
        return toolSuccess(`Cleared element: "${description}"`)
        
      } catch (error) {
        if (attempt === NUM_RETRIES) {
          return toolError(`Failed to clear "${description}": ${error instanceof Error ? error.message : String(error)}`)
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_MS))
      }
    }
    return toolError(`Failed to clear "${description}" after ${NUM_RETRIES} attempts`)
  }

  private async _sendKeys(keys: string): Promise<ToolOutput> {
    const page = await this.executionContext.browserContext.getCurrentPage()
    await page.sendKeys(keys)
    return toolSuccess(`Sent keys: ${keys}`)
  }
}

// LangChain wrapper factory function
export function createInteractionTool(
  executionContext: ExecutionContext
): DynamicStructuredTool {
  const interactionTool = new InteractionTool(executionContext)
  const ToolCtor = DynamicStructuredTool as unknown as new (config: any) => DynamicStructuredTool
  return new ToolCtor({
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
    func: async (args: InteractionInput): Promise<string> => {
      const result = await interactionTool.execute(args)
      return JSON.stringify(result)
    }
  })
}
