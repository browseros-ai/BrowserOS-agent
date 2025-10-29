import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const ScrollInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("NodeId to scroll to (optional)"),
  direction: z
    .enum(["up", "down"])
    .optional()
    .describe("Direction to scroll page if no nodeId provided"),
  amount: z
    .number()
    .int()
    .min(1)
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
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Scrolling...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        const amount = args.amount || 1;

        if (args.nodeId) {
          const scrolled = await page.scrollToElement(args.nodeId);
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

          return JSON.stringify({
            ok: true,
            output: scrollMessage,
          });
        } else {
          return JSON.stringify({
            ok: false,
            error: "Must provide either nodeId or direction",
          });
        }
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Scroll failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
