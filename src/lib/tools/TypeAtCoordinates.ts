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
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
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

        // Execute the type operation (which includes click for focus)
        await page.typeAtCoordinates(args.x, args.y, args.text);

        return JSON.stringify({
          ok: true,
          output: `Successfully typed "${args.text}" at (${args.x}, ${args.y})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to type at coordinates: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
