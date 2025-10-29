import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const HumanInputSchema = z.object({
  prompt: z.string().describe("The situation requiring human intervention"),
});
type HumanInput = z.infer<typeof HumanInputSchema>;

export function HumanInputTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "human_input",
    description: `Request human intervention when stuck or need manual action.

Use this when:
- You need the human to manually complete a step (enter credentials, solve CAPTCHA, etc.)
- You're blocked and need the human to take over temporarily
- You encounter an error that requires human judgment
- You need confirmation before proceeding with a risky action

The human will either click "Done" (after taking action) or "Abort task" (to cancel).`,
    schema: HumanInputSchema,
    func: async (args: HumanInput) => {
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("⏸️ Requesting human input...", "thinking")
        );

        // Generate unique request ID
        const requestId = PubSubChannel.generateId("human_input");

        // Store request ID in execution context for later retrieval
        context.setHumanInputRequestId(requestId);

        // Publish message to UI showing we're waiting
        const messageId = PubSubChannel.generateId("human_input_msg");
        context
          .getPubSub()
          .publishMessage(
            PubSubChannel.createMessageWithId(
              messageId,
              `⏸️ **Waiting for human input:** ${args.prompt}`,
              "thinking",
            ),
          );

        // Publish special event for UI to show the dialog
        context.getPubSub().publishHumanInputRequest({
          requestId,
          prompt: args.prompt,
        });

        // Return immediately with special flag
        return JSON.stringify({
          ok: true,
          output: `Waiting for human input: ${args.prompt}`,
          requiresHumanInput: true,  // Special flag for execution loop
          requestId,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
