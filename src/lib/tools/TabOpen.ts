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
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Opening tab...", "thinking")
        );

        const targetUrl = args.url || "chrome://newtab/";
        const page = await context.browserContext.openTab(targetUrl);

        return JSON.stringify({
          ok: true,
          output: {
            tabId: page.tabId,
            url: targetUrl,
          },
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to open tab: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
