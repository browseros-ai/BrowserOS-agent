import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const WaitInputSchema = z.object({
  seconds: z
    .number()
    .min(0)
    .optional()
    .default(2)
    .describe("Additional seconds to wait (default: 2)"),
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
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Waiting for ${args.seconds}...`, "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.waitForStability();
        const waitSeconds = args.seconds || 2;
        if (waitSeconds > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, waitSeconds * 1000),
          );
        }

        return JSON.stringify({
          ok: true,
          output: `Waited ${waitSeconds} seconds for stability`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Wait failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
