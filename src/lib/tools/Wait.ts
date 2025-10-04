import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const WaitInputSchema = z.object({
  seconds: z
    .number()
    .positive()
    .optional()
    .default(1)
    .describe("Additional seconds to wait (default: 1)"),
});
type WaitInput = z.infer<typeof WaitInputSchema>;

export function WaitTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "wait",
    description: "Wait for page to stabilize after actions",
    schema: WaitInputSchema,
    func: async (args: WaitInput) => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        const waitSeconds = args.seconds || 1

        // Publish tool start event
        context.publishTool(toolId, 'wait', 'start',
          `⏳ Waiting ${waitSeconds} seconds`,
          { args })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Waiting for ${waitSeconds}s...`, "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.waitForStability();
        if (waitSeconds > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, waitSeconds * 1000),
          );
        }

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'wait', 'result',
          `✅ Waited ${waitSeconds} seconds`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: `Waited ${waitSeconds} seconds for stability`,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'wait', 'error',
          `❌ Wait failed: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Wait failed: ${errorMessage}`,
        });
      }
    },
  });
}
