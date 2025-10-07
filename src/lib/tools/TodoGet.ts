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
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'todo_get', 'start',
          `📝 Getting TODO list`,
          { args })

        const todoList = context.getTodoList() || "No todos yet"

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'todo_get', 'result',
          `✅ Retrieved TODO list`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: todoList,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'todo_get', 'error',
          `❌ Failed to get todos: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to get todos: ${errorMessage}`,
        });
      }
    },
  });
}
