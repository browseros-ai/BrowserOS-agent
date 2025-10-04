import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const ScrollInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("NodeId to scroll to (optional)"),
  direction: z
    .enum(["up", "down"])
    .optional()
    .describe("Direction to scroll page if no nodeId provided"),
  amount: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe("Number of viewport heights to scroll (default: 1)"),
});
type ScrollInput = z.infer<typeof ScrollInputSchema>;

export function ScrollTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "scroll",
    description: "Scroll to a specific element or scroll the page",
    schema: ScrollInputSchema,
    func: async (args: ScrollInput) => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        const startMsg = args.nodeId
          ? `📜 Scrolling to element ${args.nodeId}`
          : `📜 Scrolling ${args.direction} ${args.amount || 1} viewport(s)`
        context.publishTool(toolId, 'scroll', 'start', startMsg, { args })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Scrolling...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        const amount = args.amount || 1;

        if (args.nodeId) {
          const scrolled = await page.scrollToElement(args.nodeId);

          // Publish tool result event
          const duration = Date.now() - startTime
          context.publishTool(toolId, 'scroll', 'result',
            `✅ Scrolled to element ${args.nodeId}`,
            { result: { ok: true }, duration })

          return JSON.stringify({
            ok: true,
            output: `Scrolled to element : ${args.nodeId} ${scrolled ? "success" : "already visible"}`,
          });
        } else if (args.direction) {
          let result;
          if (args.direction === "down") {
            result = await page.scrollDown(amount);
          } else {
            result = await page.scrollUp(amount);
          }

          const scrollMessage = result.didScroll
            ? `Scrolled ${args.direction} ${amount} viewport(s)`
            : `Already at ${args.direction === "down" ? "bottom" : "top"} of page - no space to scroll ${args.direction}`;

          // Publish tool result event
          const duration = Date.now() - startTime
          context.publishTool(toolId, 'scroll', 'result',
            `✅ ${scrollMessage}`,
            { result: { ok: true }, duration })

          return JSON.stringify({
            ok: true,
            output: scrollMessage,
          });
        } else {
          // Publish tool error event
          const duration = Date.now() - startTime
          context.publishTool(toolId, 'scroll', 'error',
            `❌ Must provide either nodeId or direction`,
            { error: 'Missing parameters', duration })

          return JSON.stringify({
            ok: false,
            error: "Must provide either nodeId or direction",
          });
        }
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'scroll', 'error',
          `❌ Scroll failed: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Scroll failed: ${errorMessage}`,
        });
      }
    },
  });
}
