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
      try {
        context.incrementMetric("toolCalls");

        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(args.todos, "thinking")
        );
        context.setTodoList(args.todos);

        Logging.log(
          "NewAgent",
          `Updated todo list: ${args.todos.split("\n").length} items`,
          "info",
        );

        return JSON.stringify({
          ok: true,
          output: "Todos updated",
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to update todos: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
