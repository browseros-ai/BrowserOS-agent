import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const MoondreamVisualClickInputSchema = z.object({
  instruction: z
    .string()
    .describe(
      "Describe what to click on (e.g., 'button', 'blue submit button', 'search icon')",
    ),
});
type MoondreamVisualClickInput = z.infer<
  typeof MoondreamVisualClickInputSchema
>;

interface MoondreamPointResponse {
  request_id?: string;
  points: Array<{ x: number; y: number }>;
  error?: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export function MoondreamVisualClickTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "visual_click",
    description:
      "Click on any element by describing what it looks like. Pass a clear description like 'blue submit button', 'search icon', 'first checkbox', 'close button in modal', etc.",
    schema: MoondreamVisualClickInputSchema,
    func: async (args: MoondreamVisualClickInput) => {
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("🎯 Clicking...", "thinking")
        );

        // Get API key from environment
        const apiKey = process.env.MOONDREAM_API_KEY;
        if (!apiKey) {
          return JSON.stringify({
            ok: false,
            error: "Vision API key not provided.",
          });
        }

        // Get current page
        const page = await context.browserContext.getCurrentPage();

        // Get viewport dimensions
        const viewport = await page.executeJavaScript(`
          ({ width: window.innerWidth, height: window.innerHeight })
        `);

        // Take screenshot with exact viewport dimensions for accurate coordinate mapping
        const screenshot = await page.takeScreenshotWithDimensions(
          viewport.width,
          viewport.height,
          false,  // no highlights
        );
        if (!screenshot) {
          return JSON.stringify({
            ok: false,
            error: "Failed to capture screenshot for Moondream visual click",
          });
        }

        // Call Moondream API
        const response = await fetch("https://api.moondream.ai/v1/point", {
          method: "POST",
          headers: {
            "X-Moondream-Auth": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: screenshot,
            object: args.instruction,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage =
            errorData.error?.message || `API error: ${response.status}`;
          return JSON.stringify({
            ok: false,
            error: `Moondream API error: ${errorMessage}`,
          });
        }

        const data: MoondreamPointResponse = await response.json();

        // Check if any points were found
        if (!data.points || data.points.length === 0) {
          return JSON.stringify({
            ok: false,
            error: `No "${args.instruction}" found on the page`,
          });
        }

        // Use the first point (most confident match)
        const point = data.points[0];

        // Convert normalized coordinates (0-1) to viewport pixels
        const x = Math.round(point.x * viewport.width);
        const y = Math.round(point.y * viewport.height);

        // Use the clickAtCoordinates method
        await page.clickAtCoordinates(x, y);

        return JSON.stringify({
          ok: true,
          output: {
            coordinates: { x, y },
            description: `Clicked "${args.instruction}" at (${x}, ${y})`,
            pointsFound: data.points.length,
          },
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Moondream click failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
