import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { Logging } from "@/lib/utils/Logging";

const TodoSetInputSchema = z.object({
  todos: z.string().describe("Markdown formatted todo list"),
});
type TodoSetInput = z.infer<typeof TodoSetInputSchema>;

export function TodoSetTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "todo_set",
    description:
      "Set or update the TODO list with markdown checkboxes (- [ ] pending, - [x] done)",
    schema: TodoSetInputSchema,
    func: async (args: TodoSetInput) => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        const itemCount = args.todos.split("\n").length
        context.publishTool(toolId, 'todo_set', 'start',
          `📝 Updating TODO list (${itemCount} items)`,
          { args })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(args.todos, "thinking")
        );
        context.setTodoList(args.todos);

        Logging.log(
          "NewAgent",
          `Updated todo list: ${itemCount} items`,
          "info",
        );

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'todo_set', 'result',
          `✅ Updated TODO list`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: "Todos updated",
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'todo_set', 'error',
          `❌ Failed to update todos: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Failed to update todos: ${errorMessage}`,
        });
      }
    },
  });
}
