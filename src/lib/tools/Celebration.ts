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
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'celebration', 'start',
          `🎉 Triggering celebration`,
          { args: {} })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("🎉 Celebrating...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();
        if (!page) {
          const duration = Date.now() - startTime
          const errorMessage = "No active page to show celebration"
          context.publishTool(toolId, 'celebration', 'error',
            `❌ ${errorMessage}`,
            { error: errorMessage, duration })
          return JSON.stringify({
            ok: false,
            error: errorMessage
          });
        }

        // Execute confetti script
        await page.executeJavaScript(CONFETTI_SCRIPT);

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'celebration', 'result',
          `✅ Confetti celebration shown!`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: "Confetti celebration shown!"
        });

      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'celebration', 'error',
          `❌ Failed to show celebration: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to show celebration: ${errorMessage}`
        });
      }
    }
  });
}
