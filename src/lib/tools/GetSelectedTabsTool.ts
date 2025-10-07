import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/ToolInterface"
import { PubSub } from "@/lib/pubsub"

// Input schema - no input required
export const GetSelectedTabsInputSchema = z.object({})

export type GetSelectedTabsInput = z.infer<typeof GetSelectedTabsInputSchema>

// Tab info schema
export const TabInfoSchema = z.object({
  id: z.number(),  // Tab ID
  url: z.string(),  // Current URL
  title: z.string()  // Page title
})

export type TabInfo = z.infer<typeof TabInfoSchema>

export class GetSelectedTabsToolImpl {
  constructor(private executionContext: ExecutionContext) {}

  async execute(_input: GetSelectedTabsInput): Promise<ToolOutput> {
    try {
      this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Getting selected tabs`, 'thinking'))
      
      // Get selected tab IDs from execution context
      const selectedTabIds = this.executionContext.getSelectedTabIds()
      const hasUserSelectedTabs = Boolean(selectedTabIds && selectedTabIds.length > 0)
      
      // Get browser pages
      const pages = await this.executionContext.browserContext.getPages(
        hasUserSelectedTabs && selectedTabIds ? selectedTabIds : undefined
      )
      
      // If no pages found, return empty array
      if (pages.length === 0) {
        return toolSuccess(JSON.stringify([]))
      }
      
      // Extract tab information
      const tabs: TabInfo[] = await Promise.all(
        pages.map(async page => ({
          id: page.tabId,
          url: page.url(),
          title: await page.title()
        }))
      )
      
      // Return simplified output - just the array of tabs
      return toolSuccess(JSON.stringify(tabs))
      
    } catch (error) {
      return toolError(`Failed to get tab information: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// LangChain wrapper factory function
export function GetSelectedTabsTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const tool = new GetSelectedTabsToolImpl(executionContext)

  return new DynamicStructuredTool({
    name: "get_selected_tabs_tool",
    description: "Get information about currently selected tabs. Returns an array of tab objects with id, url, and title. If no tabs are selected, returns the current tab.",
    schema: GetSelectedTabsInputSchema,
    func: async (args): Promise<string> => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        // Publish tool start event
        executionContext.publishTool(toolId, 'get_selected_tabs_tool', 'start',
          `🔖 Getting selected tabs`,
          { args })

        const result = await tool.execute(args)

        // Publish tool result event
        const duration = Date.now() - startTime
        if (result.ok) {
          executionContext.publishTool(toolId, 'get_selected_tabs_tool', 'result',
            `✅ Retrieved selected tabs`,
            { result, duration })
        } else {
          executionContext.publishTool(toolId, 'get_selected_tabs_tool', 'error',
            `❌ ${result.output}`,
            { error: result.output, duration })
        }

        return JSON.stringify(result)
      } catch (error) {
        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        executionContext.publishTool(toolId, 'get_selected_tabs_tool', 'error',
          `❌ Get selected tabs failed: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({ ok: false, error: errorMessage })
      }
    }
  })
}
