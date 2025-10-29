import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const TabCloseInputSchema = z.object({
  tabId: z.number().int().min(1).describe("Tab ID to close"),
});
type TabCloseInput = z.infer<typeof TabCloseInputSchema>;

export function TabCloseTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tab_close",
    description: "Close a specific tab by ID",
    schema: TabCloseInputSchema,
    func: async (args: TabCloseInput) => {
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Closing tab...", "thinking")
        );

        // Verify tab exists
        const tab = await chrome.tabs.get(args.tabId);
        const title = tab.title || "Untitled";

        // Close tab using browserContext
        await context.browserContext.closeTab(args.tabId);

        return JSON.stringify({
          ok: true,
          output: `Closed tab: ${title} (ID: ${args.tabId})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to close tab ${args.tabId}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
