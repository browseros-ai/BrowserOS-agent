import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";

const TodoGetInputSchema = z.object({});
type TodoGetInput = z.infer<typeof TodoGetInputSchema>;

export function TodoGetTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "todo_get",
    description: "Get the current TODO list",
    schema: TodoGetInputSchema,
    func: async (args: TodoGetInput) => {
      try {
        context.incrementMetric("toolCalls");

        return JSON.stringify({
          ok: true,
          output: context.getTodoList() || "No todos yet",
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to get todos: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
