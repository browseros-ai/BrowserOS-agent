import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/ToolInterface"
import { PubSub } from "@/lib/pubsub"

// Constants
const DEFAULT_GROUP_COLOR = "blue"
const VALID_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"] as const

// Input schema for group tabs operations
export const GroupTabsInputSchema = z.object({
  tabIds: z.array(z.number()).min(1),  // Tab IDs to group
  groupName: z.string().optional(),  // Optional group name
  color: z.enum(VALID_COLORS).optional(),  // Optional group color
})

export type GroupTabsInput = z.infer<typeof GroupTabsInputSchema>

export class GroupTabsToolImpl {
  constructor(private executionContext: ExecutionContext) {}

  async execute(input: GroupTabsInput): Promise<ToolOutput> {
    try {
      // Get current window ID
      this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Grouping tabs ${input.tabIds.join(", ")} with name: ${input.groupName}`, 'thinking'))
      const currentTab = await chrome.tabs.getCurrent()
      const windowId = currentTab?.windowId
      
      // Validate tab IDs exist in current window
      const tabs = await chrome.tabs.query({ windowId })
      const validTabIds = input.tabIds.filter(id => 
        tabs.some(tab => tab.id === id)
      )

      if (validTabIds.length === 0) {
        return toolError(`No valid tabs found with IDs: ${input.tabIds.join(", ")}`)
      }

      // Create the group
      const groupId = await chrome.tabs.group({ tabIds: validTabIds })

      // Update group properties if chrome.tabGroups is available
      if (chrome.tabGroups?.update) {
        const updateProps: chrome.tabGroups.UpdateProperties = {
          color: input.color || DEFAULT_GROUP_COLOR
        }
        if (input.groupName) {
          updateProps.title = input.groupName
        }
        await chrome.tabGroups.update(groupId, updateProps)
      }

      // Build success message
      const tabText = validTabIds.length === 1 ? "tab" : "tabs"
      if (input.groupName) {
        return toolSuccess(`Grouped ${validTabIds.length} ${tabText} as "${input.groupName}"`)
      }
      return toolSuccess(`Grouped ${validTabIds.length} ${tabText}`)
      
    } catch (error) {
      return toolError(`Failed to group tabs: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// LangChain wrapper factory function
export function GroupTabsTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const tool = new GroupTabsToolImpl(executionContext)
  
  return new DynamicStructuredTool({
    name: "group_tabs_tool",
    description: "Group browser tabs together. Pass tabIds array and optionally groupName and color (grey, blue, red, yellow, green, pink, purple, cyan, orange).",
    schema: GroupTabsInputSchema,
    func: async (args): Promise<string> => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        // Publish tool start event
        executionContext.publishTool(toolId, 'group_tabs_tool', 'start',
          `🔖 Grouping ${args.tabIds.length} tabs`,
          { args })

        const result = await tool.execute(args)

        // Publish tool result event
        const duration = Date.now() - startTime
        if (result.ok) {
          executionContext.publishTool(toolId, 'group_tabs_tool', 'result',
            `✅ ${result.output}`,
            { result, duration })
        } else {
          executionContext.publishTool(toolId, 'group_tabs_tool', 'error',
            `❌ ${result.output}`,
            { error: result.output, duration })
        }

        return JSON.stringify(result)
      } catch (error) {
        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        executionContext.publishTool(toolId, 'group_tabs_tool', 'error',
          `❌ Group tabs failed: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({ ok: false, error: errorMessage })
      }
    }
  })
}
