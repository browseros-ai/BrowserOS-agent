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
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'click_at_coordinates', 'start',
          `🖱️ Clicking at coordinates (${args.x}, ${args.y})`,
          { args })

        // Also publish to old system for backward compatibility
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
          const duration = Date.now() - startTime
          const errorMessage = `X coordinate ${args.x} is outside viewport width (0-${viewport.width})`
          context.publishTool(toolId, 'click_at_coordinates', 'error',
            `❌ ${errorMessage}`,
            { error: errorMessage, duration })
          return JSON.stringify({
            ok: false,
            error: errorMessage,
          });
        }

        if (args.y < 0 || args.y > viewport.height) {
          const duration = Date.now() - startTime
          const errorMessage = `Y coordinate ${args.y} is outside viewport height (0-${viewport.height})`
          context.publishTool(toolId, 'click_at_coordinates', 'error',
            `❌ ${errorMessage}`,
            { error: errorMessage, duration })
          return JSON.stringify({
            ok: false,
            error: errorMessage,
          });
        }

        // Execute the click
        await page.clickAtCoordinates(args.x, args.y);

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'click_at_coordinates', 'result',
          `✅ Clicked at (${args.x}, ${args.y})`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: `Successfully clicked at (${args.x}, ${args.y})`,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'click_at_coordinates', 'error',
          `❌ Failed to click at coordinates: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to click at coordinates: ${errorMessage}`,
        });
      }
    },
  });
}
