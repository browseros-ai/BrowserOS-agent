import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/Tool.interface"
import { PubSub } from "@/lib/pubsub"

// Constants
const DEFAULT_VIEWPORT_COUNT = 1

// Input schema for scroll operations
export const ScrollInputSchema = z.object({
  operationType: z.enum(["scroll_down", "scroll_up", "scroll_to_element"]),  // Operation to perform
  index: z.number().optional(),  // Element index for scroll_to_element
  times: z.number().int().min(1).optional(), // Optional number of times to scroll (default 1)
})

export type ScrollInput = z.infer<typeof ScrollInputSchema>

export class ScrollTool {
  constructor(private executionContext: ExecutionContext) {}

  async execute(input: ScrollInput): Promise<ToolOutput> {
    // Validate input
    if (input.operationType === "scroll_to_element" && input.index === undefined) {
      return toolError("scroll_to_element operation requires index parameter")
    }

    try {
      const page = await this.executionContext.browserContext.getCurrentPage()
      
      switch (input.operationType) {
        case "scroll_down":
          return await this._scrollDown(page, input.times)
        case "scroll_up":
          return await this._scrollUp(page, input.times)
        case "scroll_to_element":
          return await this._scrollToElement(page, input.index!)
      }
    } catch (error) {
      return toolError(`Scroll operation failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async _scrollDown(page: any, times?: number): Promise<ToolOutput> {
    const count = typeof times === 'number' && times > 0 ? times : DEFAULT_VIEWPORT_COUNT
    for (let i = 0; i < count; i++) {
      await page.scrollDown(DEFAULT_VIEWPORT_COUNT)
    }
    const msg = `Scrolled down ${count} viewport${count === 1 ? '' : 's'}`
    // Emit status message
    this.executionContext.getPubSub().publishMessage(PubSub.createMessage(msg, 'thinking'))
    return toolSuccess(msg)
  }

  private async _scrollUp(page: any, times?: number): Promise<ToolOutput> {
    const count = typeof times === 'number' && times > 0 ? times : DEFAULT_VIEWPORT_COUNT
    for (let i = 0; i < count; i++) {
      await page.scrollUp(DEFAULT_VIEWPORT_COUNT)
    }
    const msg = `Scrolled up ${count} viewport${count === 1 ? '' : 's'}`
    // Emit status message
    this.executionContext.getPubSub().publishMessage(PubSub.createMessage(msg, 'thinking'))
    return toolSuccess(msg)
  }

  private async _scrollToElement(page: any, index: number): Promise<ToolOutput> {
    const element = await page.getElementByIndex(index)
    
    if (!element) {
      return toolError(`Element with index ${index} not found`)
    }

    const success = await page.scrollToElement(element.nodeId)
    
    if (!success) {
      return toolError(`Could not scroll to element ${index}`)
    }

    const elementInfo = `${element.tag || "unknown"} "${element.text || ""}"`.trim()
    
    // Emit status message
    this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Scrolled to element: ${elementInfo}`, 'thinking'))
    
    return toolSuccess(`Scrolled to element ${index} (${elementInfo})`)
  }
}

// LangChain wrapper factory function
export function createScrollTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const scrollTool = new ScrollTool(executionContext)
  
  return new DynamicStructuredTool({
    name: "scroll_tool",
    description: "Perform scrolling operations: scroll_down/up (by viewports) or scroll_to_element (by index). Optional 'times' controls how many viewports to scroll (default 1).",
    schema: ScrollInputSchema,
    func: async (args): Promise<string> => {
      const result = await scrollTool.execute(args)
      return JSON.stringify(result)
    }
  })
}
