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
      context.incrementMetric("toolCalls");

      return JSON.stringify({
        ok: true,
        output: {
          success: args.success,
          message: args.message
        },
      });
    },
  });
}
