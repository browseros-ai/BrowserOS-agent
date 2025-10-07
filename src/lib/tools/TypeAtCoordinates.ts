import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const TypeAtCoordinatesInputSchema = z.object({
  x: z.number().int().nonnegative().describe("X coordinate in viewport pixels"),
  y: z.number().int().nonnegative().describe("Y coordinate in viewport pixels"),
  text: z.string().describe("Text to type at the specified coordinates"),
});
type TypeAtCoordinatesInput = z.infer<typeof TypeAtCoordinatesInputSchema>;

export function TypeAtCoordinatesTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "type_at_coordinates",
    description:
      "Type text at specific viewport coordinates (x, y). The tool will first click at the coordinates to focus, then type the text. Use when you have exact pixel coordinates for a text input field.",
    schema: TypeAtCoordinatesInputSchema,
    func: async (args: TypeAtCoordinatesInput) => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'type_at_coordinates', 'start',
          `⌨️ Typing at coordinates (${args.x}, ${args.y})`,
          { args })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Typing "${args.text}"...`, "thinking")
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
          context.publishTool(toolId, 'type_at_coordinates', 'error',
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
          context.publishTool(toolId, 'type_at_coordinates', 'error',
            `❌ ${errorMessage}`,
            { error: errorMessage, duration })
          return JSON.stringify({
            ok: false,
            error: errorMessage,
          });
        }

        // Execute the type operation (which includes click for focus)
        await page.typeAtCoordinates(args.x, args.y, args.text);

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'type_at_coordinates', 'result',
          `✅ Typed "${args.text}" at (${args.x}, ${args.y})`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: `Successfully typed "${args.text}" at (${args.x}, ${args.y})`,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'type_at_coordinates', 'error',
          `❌ Failed to type at coordinates: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to type at coordinates: ${errorMessage}`,
        });
      }
    },
  });
}
