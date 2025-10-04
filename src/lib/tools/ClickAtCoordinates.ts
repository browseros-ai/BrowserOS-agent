import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const ClickAtCoordinatesInputSchema = z.object({
  x: z.number().int().nonnegative().describe("X coordinate in viewport pixels"),
  y: z.number().int().nonnegative().describe("Y coordinate in viewport pixels"),
});
type ClickAtCoordinatesInput = z.infer<typeof ClickAtCoordinatesInputSchema>;

export function ClickAtCoordinatesTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "click_at_coordinates",
    description:
      "Click at specific viewport coordinates (x, y). Use when you have exact pixel coordinates where you want to click.",
    schema: ClickAtCoordinatesInputSchema,
    func: async (args: ClickAtCoordinatesInput) => {
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Clicking...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Get viewport dimensions for validation
        const viewport = await page.executeJavaScript(`
          ({ width: window.innerWidth, height: window.innerHeight })
        `);

        // Validate coordinates are within viewport bounds
        if (args.x < 0 || args.x > viewport.width) {
          return JSON.stringify({
            ok: false,
            error: `X coordinate ${args.x} is outside viewport width (0-${viewport.width})`,
          });
        }

        if (args.y < 0 || args.y > viewport.height) {
          return JSON.stringify({
            ok: false,
            error: `Y coordinate ${args.y} is outside viewport height (0-${viewport.height})`,
          });
        }

        // Execute the click
        await page.clickAtCoordinates(args.x, args.y);

        return JSON.stringify({
          ok: true,
          output: `Successfully clicked at (${args.x}, ${args.y})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to click at coordinates: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
