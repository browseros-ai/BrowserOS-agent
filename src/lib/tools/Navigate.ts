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
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Navigating...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.navigateTo(args.url);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully navigated to ${args.url}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
