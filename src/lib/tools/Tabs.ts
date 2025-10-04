import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const TabsInputSchema = z.object({});
type TabsInput = z.infer<typeof TabsInputSchema>;

export function TabsTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tabs",
    description: "List all tabs in the current browser window",
    schema: TabsInputSchema,
    func: async (args: TabsInput) => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'tabs', 'start',
          `🔖 Listing browser tabs`,
          { args })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Listing browser tabs...", "thinking")
        );

        // Get current window
        const currentWindow = await chrome.windows.getCurrent();

        // Get tabs in current window
        const tabs = await chrome.tabs.query({
          windowId: currentWindow.id,
        });

        // Format tab info
        const tabList = tabs
          .filter((tab) => tab.id !== undefined)
          .map((tab) => ({
            id: tab.id!,
            title: tab.title || "Untitled",
            url: tab.url || "",
            active: tab.active || false,
          }));

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'tabs', 'result',
          `✅ Found ${tabList.length} tabs`,
          { result: { ok: true, count: tabList.length }, duration })

        return JSON.stringify({
          ok: true,
          output: tabList,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'tabs', 'error',
          `❌ Failed to list tabs: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to list tabs: ${errorMessage}`,
        });
      }
    },
  });
}
