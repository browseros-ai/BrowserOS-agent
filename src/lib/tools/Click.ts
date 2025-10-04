import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";

const ClickInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .positive()
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
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'click', 'start',
          `🖱️ Clicking element ${args.nodeId}`,
          { args })

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Ensure element is in viewport
        const { element, scrollMessage } = await page.ensureElementInViewport(
          args.nodeId,
        );
        if (!element) {
          // Publish tool error event
          const duration = Date.now() - startTime
          context.publishTool(toolId, 'click', 'error',
            `❌ Element ${args.nodeId} not found`,
            { error: 'Element not found', duration })

          return JSON.stringify({
            ok: false,
            error: `Element not found`,
          });
        }

        await page.clickElement(args.nodeId);
        await page.waitForStability();

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'click', 'result',
          `✅ Clicked element ${args.nodeId}`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: `Successfully clicked element ${args.nodeId} ${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'click', 'error',
          `❌ Click failed: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to click : ${errorMessage}`,
        });
      }
    },
  });
}
