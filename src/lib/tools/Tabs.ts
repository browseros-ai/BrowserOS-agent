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
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
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

        return JSON.stringify({
          ok: true,
          output: tabList,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to list tabs: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
