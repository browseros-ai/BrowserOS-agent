import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { toolSuccess } from '@/lib/tools/tool.interface';

// Input schema - simple optional summary
const DoneInputSchema = z.object({
  summary: z.string().optional()  // Optional completion summary
});

type DoneInput = z.infer<typeof DoneInputSchema>;

// Factory function to create DoneTool
export function createDoneTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'done_tool',
    description: 'Mark task as complete',
    schema: DoneInputSchema,
    func: async (args: DoneInput): Promise<string> => {
      const summary = args.summary || 'Task completed successfully';
      return JSON.stringify(toolSuccess(summary));
    }
  });
}