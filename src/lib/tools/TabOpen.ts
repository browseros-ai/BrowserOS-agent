import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const TabOpenInputSchema = z.object({
  url: z
    .string()
    .url()
    .optional()
    .describe("URL to open (optional, defaults to new tab page)"),
});
type TabOpenInput = z.infer<typeof TabOpenInputSchema>;

export function TabOpenTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tab_open",
    description: "Open a new browser tab with optional URL",
    schema: TabOpenInputSchema,
    func: async (args: TabOpenInput) => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        const targetUrl = args.url || "chrome://newtab/";
        context.publishTool(toolId, 'tab_open', 'start',
          `🔖 Opening new tab${args.url ? ` (${args.url})` : ''}`,
          { args })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Opening tab...", "thinking")
        );

        const page = await context.browserContext.openTab(targetUrl);

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'tab_open', 'result',
          `✅ Opened new tab (ID: ${page.tabId})`,
          { result: { ok: true, tabId: page.tabId }, duration })

        return JSON.stringify({
          ok: true,
          output: {
            tabId: page.tabId,
            url: targetUrl,
          },
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'tab_open', 'error',
          `❌ Failed to open tab: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to open tab: ${errorMessage}`,
        });
      }
    },
  });
}
