import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const TypeInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .positive()
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
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'type', 'start',
          `⌨️ Typing "${args.text}" into element ${args.nodeId}`,
          { args })

        // Also publish to old system for backward compatibility
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
          // Publish tool error event
          const duration = Date.now() - startTime
          context.publishTool(toolId, 'type', 'error',
            `❌ Element ${args.nodeId} not found`,
            { error: 'Element not found', duration })

          return JSON.stringify({
            ok: false,
            error: `Element not found`,
          });
        }

        await page.inputText(args.nodeId, args.text);
        await page.waitForStability();

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'type', 'result',
          `✅ Typed into element ${args.nodeId}`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: `Successfully typed "${args.text}" into element ${args.nodeId} ${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'type', 'error',
          `❌ Type failed: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to type into : ${errorMessage}`,
        });
      }
    },
  });
}
