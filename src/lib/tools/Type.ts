import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const TypeInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .min(1)
    .describe("The nodeId number from [brackets] in element list"),
  text: z.string().describe("Text to type into the element"),
});
type TypeInput = z.infer<typeof TypeInputSchema>;

export function TypeTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "type",
    description: "Type text into an input element",
    schema: TypeInputSchema,
    func: async (args: TypeInput) => {
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Typing "${args.text}"...`, "thinking")
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

        await page.inputText(args.nodeId, args.text);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully typed "${args.text}" into element ${args.nodeId} ${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to type into element ${args.nodeId}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
