import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/Tool.interface"

// Constants
const INTERACTION_WAIT_MS = 1000

// Input schema for interaction operations
export const InteractionInputSchema = z.object({
  operationType: z.enum(["click", "input_text", "clear", "send_keys"]),  // Operation to perform
  index: z.number().optional(),  // Element index for click/input_text/clear
  text: z.string().optional(),  // Text for input_text operation
  keys: z.string().optional(),  // Keys for send_keys operation
})

export type InteractionInput = z.infer<typeof InteractionInputSchema>

export class InteractionTool {
  constructor(private executionContext: ExecutionContext) {}

  async execute(input: InteractionInput): Promise<ToolOutput> {
    // Validate inputs
    const validation = this._validateInput(input)
    if (!validation.valid) {
      return toolError(validation.error!)
    }

    try {
      switch (input.operationType) {
        case "click":
          return await this._clickElement(input.index!)
        case "input_text":
          return await this._inputText(input.index!, input.text!)
        case "clear":
          return await this._clearElement(input.index!)
        case "send_keys":
          return await this._sendKeys(input.keys!)
      }
    } catch (error) {
      return toolError(`Interaction failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private _validateInput(input: InteractionInput): { valid: boolean; error?: string } {
    const requiresIndex = ["click", "input_text", "clear"]
    
    if (requiresIndex.includes(input.operationType) && input.index === undefined) {
      return { valid: false, error: `${input.operationType} operation requires index parameter` }
    }
    
    if (input.operationType === "input_text" && !input.text) {
      return { valid: false, error: "input_text operation requires text parameter" }
    }
    
    if (input.operationType === "send_keys" && !input.keys) {
      return { valid: false, error: "send_keys operation requires keys parameter" }
    }

    return { valid: true }
  }

  private async _clickElement(index: number): Promise<ToolOutput> {
    const page = await this.executionContext.browserContext.getCurrentPage()
    const element = await page.getElementByIndex(index)
    
    if (!element) {
      return toolError(`Element with index ${index} not found`)
    }

    // Check for file uploader
    if (page.isFileUploader(element)) {
      return toolError(`Element ${index} opens a file upload dialog. File uploads are not supported.`)
    }

    // Click element
    await page.clickElement(element.nodeId)
    await new Promise(resolve => setTimeout(resolve, INTERACTION_WAIT_MS))
    return toolSuccess(`Clicked element ${index}`)
  }

  private async _inputText(index: number, text: string): Promise<ToolOutput> {
    const page = await this.executionContext.browserContext.getCurrentPage()
    const element = await page.getElementByIndex(index)
    if (!element) {
      return toolError(`Element with index ${index} not found`)
    }
    await page.inputText(element.nodeId, text)
    return toolSuccess(`Entered text into element ${index}`)
  }

  private async _clearElement(index: number): Promise<ToolOutput> {
    const page = await this.executionContext.browserContext.getCurrentPage()
    const element = await page.getElementByIndex(index)
    if (!element) {
      return toolError(`Element with index ${index} not found`)
    }
    await page.clearElement(element.nodeId)
    return toolSuccess(`Cleared element ${index}`)
  }

  private async _sendKeys(keys: string): Promise<ToolOutput> {
    const page = await this.executionContext.browserContext.getCurrentPage()
    await page.sendKeys(keys)
    return toolSuccess(`Sent keys: ${keys}`)
  }
}

// LangChain wrapper factory function
export function createInteractionTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const interactionTool = new InteractionTool(executionContext)
  
  return new DynamicStructuredTool({
    name: "interact_tool",
    description: "Perform element interactions: click, input_text (type text), clear (clear field), or send_keys (keyboard keys).",
    schema: InteractionInputSchema,
    func: async (args): Promise<string> => {
      const result = await interactionTool.execute(args)
      return JSON.stringify(result)
    }
  })
}
