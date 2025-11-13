import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, type ToolOutput } from "@/lib/tools/ToolInterface"
import { PubSub } from "@/lib/pubsub"

// Input schema (empty for list operation)
export const ListTabGroupsInputSchema = z.object({})

export type ListTabGroupsInput = z.infer<typeof ListTabGroupsInputSchema>

interface TabGroupInfo {
  id: number
  title: string
  color: string
  collapsed: boolean
  windowId: number
}

export class ListTabGroupsToolImpl {
  constructor(private executionContext: ExecutionContext) {}

  async execute(input: ListTabGroupsInput): Promise<ToolOutput> {
    try {
      this.executionContext.getPubSub().publishMessage(
        PubSub.createMessage("Listing tab groups...", 'thinking')
      )
      
      // Get all tab groups
      const groups = await chrome.tabGroups.query({})
      
      if (groups.length === 0) {
        return toolSuccess("No tab groups found")
      }

      // Format group information
      const groupsInfo: TabGroupInfo[] = groups.map(group => ({
        id: group.id,
        title: group.title || `Unnamed Group ${group.id}`,
        color: group.color,
        collapsed: group.collapsed,
        windowId: group.windowId
      }))

      // Get tab count for each group
      const groupsWithCounts = await Promise.all(
        groupsInfo.map(async (group) => {
          const tabsInGroup = await chrome.tabs.query({ groupId: group.id })
          return {
            ...group,
            tabCount: tabsInGroup.length
          }
        })
      )

      return toolSuccess(JSON.stringify(groupsWithCounts, null, 2))
      
    } catch (error) {
      return toolSuccess("[]") // Return empty array on error
    }
  }
}

// LangChain wrapper factory function
export function ListTabGroupsTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const tool = new ListTabGroupsToolImpl(executionContext)
  
  return new DynamicStructuredTool({
    name: "list_tab_groups",
    description: "List all existing tab groups with their IDs, names, colors, and tab counts. Use this to find group IDs before adding tabs to groups.",
    schema: ListTabGroupsInputSchema,
    func: async (args): Promise<string> => {
      const result = await tool.execute(args)
      return JSON.stringify(result)
    }
  })
}
