import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";

const ClickInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .min(1)
    .describe("The nodeId number from [brackets] in element list"),
});
type ClickInput = z.infer<typeof ClickInputSchema>;

export function ClickTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "click",
    description: "Click an element by its nodeId (number in brackets)",
    schema: ClickInputSchema,
    func: async (args: ClickInput) => {
      try {
        context.incrementMetric("toolCalls");

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

        await page.clickElement(args.nodeId);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully clicked element ${args.nodeId} ${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to click : ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
