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
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'human_input', 'start',
          `⏸️ Requesting human input: ${args.prompt}`,
          { args })

        // Generate unique request ID
        const requestId = PubSubChannel.generateId("human_input");

        // Store request ID in execution context for later retrieval
        context.setHumanInputRequestId(requestId);

        // Publish human input request using new event system
        context.publishHumanInputRequest(requestId, args.prompt)

        // Also publish to old system for backward compatibility during migration
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("⏸️ Requesting human input...", "thinking")
        );

        const messageId = PubSubChannel.generateId("human_input_msg");
        context.getPubSub().publishMessage(
          PubSubChannel.createMessageWithId(
            messageId,
            `⏸️ **Waiting for human input:** ${args.prompt}`,
            "thinking",
          ),
        );

        context.getPubSub().publishHumanInputRequest({
          requestId,
          prompt: args.prompt,
        });

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'human_input', 'result',
          '✅ Human input requested',
          { result: { ok: true, requiresHumanInput: true }, duration })

        // Return immediately with special flag
        return JSON.stringify({
          ok: true,
          output: `Waiting for human input: ${args.prompt}`,
          requiresHumanInput: true,  // Special flag for execution loop
          requestId,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'human_input', 'error',
          `❌ Human input request failed: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: errorMessage,
        });
      }
    },
  });
}
