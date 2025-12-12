import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/ToolInterface"
import { PubSub } from "@/lib/pubsub"

// Input schema for adding a tab to a group
export const AddTabToGroupInputSchema = z.object({
  tabId: z.number().describe("The ID of the tab to add to a group"),
  groupId: z.number().describe("The ID of the existing group to add the tab to")
})

export type AddTabToGroupInput = z.infer<typeof AddTabToGroupInputSchema>

export class AddTabToGroupToolImpl {
  constructor(private executionContext: ExecutionContext) {}

  async execute(input: AddTabToGroupInput): Promise<ToolOutput> {
    try {
      this.executionContext.getPubSub().publishMessage(
        PubSub.createMessage(`Adding tab ${input.tabId} to group ${input.groupId}`, 'thinking')
      )
      
      // Validate the tab exists
      const tab = await chrome.tabs.get(input.tabId)
      if (!tab) {
        return toolError(`Tab with ID ${input.tabId} not found`)
      }

      // Validate the group exists
      const groups = await chrome.tabGroups.query({})
      const targetGroup = groups.find(g => g.id === input.groupId)
      if (!targetGroup) {
        return toolError(`Group with ID ${input.groupId} not found`)
      }

      // Add the tab to the group
      await chrome.tabs.group({
        groupId: input.groupId,
        tabIds: [input.tabId]
      })

      const groupName = targetGroup.title || `Group ${input.groupId}`
      return toolSuccess(`Added tab "${tab.title}" to group "${groupName}"`)
      
    } catch (error) {
      return toolError(`Failed to add tab to group: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// LangChain wrapper factory function
export function AddTabToGroupTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const tool = new AddTabToGroupToolImpl(executionContext)
  
  return new DynamicStructuredTool({
    name: "add_tab_to_group",
    description: "Add a specific tab to an existing tab group. Use this to move a tab into a group. Requires the tab ID and the group ID.",
    schema: AddTabToGroupInputSchema,
    func: async (args): Promise<string> => {
      const result = await tool.execute(args)
      return JSON.stringify(result)
    }
  })
}
