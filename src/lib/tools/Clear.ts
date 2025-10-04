import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const ClearInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .positive()
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
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'clear', 'start',
          `🧹 Clearing element ${args.nodeId}`,
          { args })

        // Also publish to old system for backward compatibility
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
          // Publish tool error event
          const duration = Date.now() - startTime
          context.publishTool(toolId, 'clear', 'error',
            `❌ Element ${args.nodeId} not found`,
            { error: 'Element not found', duration })

          return JSON.stringify({
            ok: false,
            error: `Element not found`,
          });
        }

        await page.clearElement(args.nodeId);
        await page.waitForStability();

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'clear', 'result',
          `✅ Cleared element ${args.nodeId}`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: `Successfully cleared element ${args.nodeId} ${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'clear', 'error',
          `❌ Clear failed: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to clear : ${errorMessage}`,
        });
      }
    },
  });
}
