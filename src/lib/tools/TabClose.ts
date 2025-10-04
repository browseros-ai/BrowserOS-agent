import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const TabCloseInputSchema = z.object({
  tabId: z.number().int().positive().describe("Tab ID to close"),
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
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'tab_close', 'start',
          `🔖 Closing tab (ID: ${args.tabId})`,
          { args })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Closing tab...", "thinking")
        );

        // Verify tab exists
        const tab = await chrome.tabs.get(args.tabId);
        const title = tab.title || "Untitled";

        // Close tab using browserContext
        await context.browserContext.closeTab(args.tabId);

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'tab_close', 'result',
          `✅ Closed tab: ${title}`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: `Closed tab: ${title} (ID: ${args.tabId})`,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'tab_close', 'error',
          `❌ Failed to close tab: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to close tab ${args.tabId}: ${errorMessage}`,
        });
      }
    },
  });
}
