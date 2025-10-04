import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const TabFocusInputSchema = z.object({
  tabId: z.number().int().positive().describe("Tab ID to focus"),
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
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'tab_focus', 'start',
          `🔖 Switching to tab (ID: ${args.tabId})`,
          { args })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Switching tab...", "thinking")
        );

        // Switch to tab using browserContext
        await context.browserContext.switchTab(args.tabId);

        // Get tab info for confirmation
        const tab = await chrome.tabs.get(args.tabId);

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'tab_focus', 'result',
          `✅ Focused tab: ${tab.title || "Untitled"}`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: `Focused tab: ${tab.title || "Untitled"} (ID: ${args.tabId})`,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'tab_focus', 'error',
          `❌ Failed to focus tab: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to focus tab ${args.tabId}: ${errorMessage}`,
        });
      }
    },
  });
}
