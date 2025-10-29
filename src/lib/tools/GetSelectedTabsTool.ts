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
      const result = await tool.execute(args)
      return JSON.stringify(result)
    }
  })
}
