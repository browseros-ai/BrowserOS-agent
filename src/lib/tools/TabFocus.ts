import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const TabFocusInputSchema = z.object({
  tabId: z.number().int().min(1).describe("Tab ID to focus"),
});
type TabFocusInput = z.infer<typeof TabFocusInputSchema>;

export function TabFocusTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tab_focus",
    description: "Switch focus to a specific tab by ID",
    schema: TabFocusInputSchema,
    func: async (args: TabFocusInput) => {
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Switching tab...", "thinking")
        );

        // Switch to tab using browserContext
        await context.browserContext.switchTab(args.tabId);

        // Get tab info for confirmation
        const tab = await chrome.tabs.get(args.tabId);

        return JSON.stringify({
          ok: true,
          output: `Focused tab: ${tab.title || "Untitled"} (ID: ${args.tabId})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to focus tab ${args.tabId}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
