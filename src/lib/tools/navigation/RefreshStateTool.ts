import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/Tool.interface"
import { refreshStateToolDescription } from "./RefreshStateTool.prompt"

// Input schema - no inputs needed
export const RefreshStateInputSchema = z.object({})

export type RefreshStateInput = z.infer<typeof RefreshStateInputSchema>

export class RefreshStateTool {
  constructor(private executionContext: ExecutionContext) {}

  async execute(_input: RefreshStateInput): Promise<ToolOutput> {
    try {
      const browserContext = this.executionContext.browserContext
      if (!browserContext) {
        return toolError("Browser context not available")
      }

      // Get current page
      const currentPage = await browserContext.getCurrentPage()
      if (!currentPage) {
        return toolError("No active page to refresh state from")
      }

      // Get fresh browser state
      const browserState = await browserContext.getBrowserStateString()

      return toolSuccess(browserState)
    } catch (error) {
      return toolError(`Failed to refresh browser state: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// LangChain wrapper factory function
export function createRefreshStateTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const refreshStateTool = new RefreshStateTool(executionContext)
  
  return new DynamicStructuredTool({
    name: "refresh_browser_state_tool",
    description: refreshStateToolDescription,
    schema: RefreshStateInputSchema,
    func: async (args): Promise<string> => {
      const result = await refreshStateTool.execute(args)
      return JSON.stringify(result)
    }
  })
}
