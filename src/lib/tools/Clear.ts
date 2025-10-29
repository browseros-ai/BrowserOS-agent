import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const ClearInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .min(1)
    .describe("The nodeId number from [brackets] in element list"),
});
type ClearInput = z.infer<typeof ClearInputSchema>;

export function ClearTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "clear",
    description: "Clear text from an input element",
    schema: ClearInputSchema,
    func: async (args: ClearInput) => {
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Clearing text...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Ensure element is in viewport
        const { element, scrollMessage } = await page.ensureElementInViewport(
          args.nodeId,
        );
        if (!element) {
          return JSON.stringify({
            ok: false,
            error: `Element not found`,
          });
        }

        await page.clearElement(args.nodeId);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully cleared element ${args.nodeId} ${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to clear : ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
