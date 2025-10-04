import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { CONFETTI_SCRIPT } from "@/lib/utils/confetti";

export function CelebrationTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "celebration",
    description: "Shows a confetti celebration animation on the current page. Use this to celebrate successful actions like upvoting or starring.",
    schema: z.object({}),  // No parameters needed
    func: async () => {
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("🎉 Celebrating...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();
        if (!page) {
          return JSON.stringify({
            ok: false,
            error: "No active page to show celebration"
          });
        }

        // Execute confetti script
        await page.executeJavaScript(CONFETTI_SCRIPT);

        return JSON.stringify({
          ok: true,
          output: "Confetti celebration shown!"
        });

      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to show celebration: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  });
}
