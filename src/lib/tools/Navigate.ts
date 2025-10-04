import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const NavigateInputSchema = z.object({
  url: z
    .string()
    .url()
    .describe("Full URL to navigate to (must include https://)"),
});
type NavigateInput = z.infer<typeof NavigateInputSchema>;

export function NavigateTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "navigate",
    description: "Navigate to a URL",
    schema: NavigateInputSchema,
    func: async (args: NavigateInput) => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'navigate', 'start',
          `🧭 Navigating to ${args.url}`,
          { args })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Navigating...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.navigateTo(args.url);
        await page.waitForStability();

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'navigate', 'result',
          `✅ Navigated to ${args.url}`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: `Successfully navigated to ${args.url}`,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'navigate', 'error',
          `❌ Navigation failed: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Navigation failed: ${errorMessage}`,
        });
      }
    },
  });
}
