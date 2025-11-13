import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/ToolInterface"
import { PubSub } from "@/lib/pubsub"

// Constants
const VALID_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"] as const
const DEFAULT_COLOR = "blue"

// Input schema for creating a tab group
export const CreateTabGroupInputSchema = z.object({
  name: z.string().min(1).max(50).describe("Name for the new tab group"),
  color: z.enum(VALID_COLORS).default(DEFAULT_COLOR).describe("Color for the tab group (grey, blue, red, yellow, green, pink, purple, cyan, orange)"),
  tabIds: z.array(z.number()).min(1).optional().describe("Optional: Tab IDs to add to the group immediately")
})

export type CreateTabGroupInput = z.infer<typeof CreateTabGroupInputSchema>

export class CreateTabGroupToolImpl {
  constructor(private executionContext: ExecutionContext) {}

  async execute(input: CreateTabGroupInput): Promise<ToolOutput> {
    try {
      this.executionContext.getPubSub().publishMessage(
        PubSub.createMessage(`Creating tab group "${input.name}"`, 'thinking')
      )
      
      // If no tabIds provided, we need at least one tab to create a group
      // Chrome requires at least one tab to create a group
      let tabIdsToGroup = input.tabIds || []
      
      if (tabIdsToGroup.length === 0) {
        // Get current active tab as default
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (currentTab?.id) {
          tabIdsToGroup = [currentTab.id]
        } else {
          // Get any tab from current window
          const tabs = await chrome.tabs.query({ currentWindow: true })
          if (tabs.length > 0 && tabs[0].id) {
            tabIdsToGroup = [tabs[0].id]
          } else {
            return toolError("Cannot create tab group: No tabs available")
          }
        }
      }

      // Validate tab IDs exist
      const tabs = await chrome.tabs.query({})
      const existingTabIds = new Set(tabs.map(t => t.id))
      const validTabIds = tabIdsToGroup.filter(id => existingTabIds.has(id))

      if (validTabIds.length === 0) {
        return toolError(`No valid tabs found with IDs: ${tabIdsToGroup.join(", ")}`)
      }

      // Create the group
      const groupId = await chrome.tabs.group({ tabIds: validTabIds })

      // Update group properties
      await chrome.tabGroups.update(groupId, {
        title: input.name,
        color: input.color
      })

      const tabCount = validTabIds.length
      const tabText = tabCount === 1 ? "tab" : "tabs"
      
      return toolSuccess(`Created tab group "${input.name}" (ID: ${groupId}) with ${tabCount} ${tabText}`)
      
    } catch (error) {
      return toolError(`Failed to create tab group: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// LangChain wrapper factory function
export function CreateTabGroupTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const tool = new CreateTabGroupToolImpl(executionContext)
  
  return new DynamicStructuredTool({
    name: "create_tab_group",
    description: "Create a new tab group with a name and color. Optionally add specific tabs to it immediately. Returns the group ID.",
    schema: CreateTabGroupInputSchema,
    func: async (args): Promise<string> => {
      const result = await tool.execute(args)
      return JSON.stringify(result)
    }
  })
}
