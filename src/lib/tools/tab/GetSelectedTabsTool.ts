import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/Tool.interface"

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

export class GetSelectedTabsTool {
  constructor(private executionContext: ExecutionContext) {}

  async execute(_input: GetSelectedTabsInput): Promise<ToolOutput> {
    try {
      // Get selected tab IDs from execution context
      const selectedTabIds = this.executionContext.getSelectedTabIds()
      // Get browser pages
      const pages = await this.executionContext.browserContext.getPages(
        selectedTabIds && selectedTabIds.length > 0
          ? selectedTabIds
          : undefined
      );

      // Build array of TabInfo objects
      const tabs: TabInfo[] = await Promise.all(
        pages.map(async page => ({
          id: page.tabId,
          url: page.url(),
          title: await page.title(),
        }))
      )

      // Return an actual array (empty if nothing)
      return toolSuccess(tabs);
    } catch (error) {
      return toolError(`Failed to get tab information: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// LangChain wrapper factory function
export function createGetSelectedTabsTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const getSelectedTabsTool = new GetSelectedTabsTool(executionContext)
  
  return new DynamicStructuredTool({
    name: "get_selected_tabs_tool",
    description: "Get information about currently selected tabs. Returns an array of tab objects with id, url, and title. If no tabs are selected, returns the current tab.",
    schema: GetSelectedTabsInputSchema,
    func: async (args): Promise<string> => {
      const { ok, output } = await getSelectedTabsTool.execute(args);
      return JSON.stringify({ ok, output });
    }
  })
}