import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";

const DoneInputSchema = z.object({
  success: z.boolean().describe("Whether the actions have been completed successfully"),
  message: z
    .string()
    .optional()
    .describe("Completion message or reason for failure"),
});
type DoneInput = z.infer<typeof DoneInputSchema>;

export function DoneTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "done",
    description: "Mark the actions as complete",
    schema: DoneInputSchema,
    func: async (args: DoneInput) => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      context.incrementMetric("toolCalls");

      // Publish tool start event
      context.publishTool(toolId, 'done', 'start',
        `✅ Marking task as ${args.success ? 'complete' : 'incomplete'}`,
        { args })

      // Publish tool result event
      const duration = Date.now() - startTime
      context.publishTool(toolId, 'done', 'result',
        args.success ? `✅ Task completed successfully` : `⚠️ Task marked as incomplete`,
        { result: { ok: true, success: args.success }, duration })

      return JSON.stringify({
        ok: true,
        output: {
          success: args.success,
        },
      });
    },
  });
}
