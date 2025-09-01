import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import {
  MessageManagerReadOnly,
  LLMMessageType,
} from "@/lib/runtime/MessageManager";
import {
  generatePlannerSystemPrompt,
  generatePlannerTaskPrompt,
} from "./PlannerTool.prompt";
import { toolError } from "@/lib/tools/Tool.interface";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PLANNING_CONFIG } from "./PlannerTool.config";
import { invokeWithRetry } from "@/lib/utils/retryable";
import { PubSub } from "@/lib/pubsub";
import { TokenCounter } from "@/lib/utils/TokenCounter";
import { Logging } from "@/lib/utils/Logging";

// Input schema - simple so LLM can generate and pass it
const PlannerInputSchema = z.object({
  task: z.string(), // Task to plan for
});

// Plan schema - simple structure for each step
const PlanSchema = z.object({
  steps: z.array(
    z.object({
      action: z.string(), // What to do
      reasoning: z.string(), // Why this step
    }),
  ),
});

type PlannerInput = z.infer<typeof PlannerInputSchema>;

// Factory function to create PlannerTool
export function createPlannerTool(
  executionContext: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "planner_tool",
    description: `Generate a plan for the task`,
    schema: PlannerInputSchema,
    func: async (args: PlannerInput): Promise<string> => {
      try {
        executionContext
          .getPubSub()
          .publishMessage(
            PubSub.createMessage(`Creating plan for task...`, "thinking"),
          );
        // Get LLM instance from execution context
        const llm = await executionContext.getLLM({ temperature: 0.2 });

        // Get message history excluding initial System Message saying ("Your are a web agent") as that is not required for planning
        // and excluding browser state messages as we will add that separately.
        const read_only_message_manager = new MessageManagerReadOnly(
          executionContext.messageManager,
        );
        const message_history = read_only_message_manager.getFilteredAsString([
          LLMMessageType.SYSTEM,
          LLMMessageType.BROWSER_STATE,
        ]);

        // Get browser state using BrowserContext's method
        const browserState =
          await executionContext.browserContext.getBrowserStateString(true);

        // Check if browser state exceeds token limit
        const browserStateTokens = TokenCounter.countString(browserState);
        const maxTokens = executionContext.messageManager.getMaxTokens();

        // If browser state is too large, use a placeholder message
        const browserStateString =
          browserStateTokens > maxTokens
            ? "[Browser state too large to include - exceeds token limit]"
            : browserState;

        // Generate prompts
        const systemPrompt = generatePlannerSystemPrompt();
        const taskPrompt = generatePlannerTaskPrompt(
          args.task,
          message_history,
          browserStateString,
        );

        // Prepare messages for LLM
        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(taskPrompt),
        ];

        // Log token count
        const tokenCount = TokenCounter.countMessages(messages);
        Logging.log(
          "PlannerTool",
          `Invoking LLM with ${TokenCounter.format(tokenCount)}`,
          "info",
        );

        // Get structured response from LLM with retry logic
        const structuredLLM = llm.withStructuredOutput(PlanSchema);
        const plan = await invokeWithRetry<z.infer<typeof PlanSchema>>(
          structuredLLM,
          messages,
          3,
          { signal: executionContext.abortSignal },
        );

        // Emit status message
        executionContext
          .getPubSub()
          .publishMessage(
            PubSub.createMessage(
              `Created plan with ${plan.steps.length} steps`,
              "thinking",
            ),
          );

        // Format and return result
        return JSON.stringify({
          ok: true,
          output: plan,
        });
      } catch (error) {
        // Handle error
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        executionContext
          .getPubSub()
          .publishMessage(
            PubSub.createMessageWithId(
              PubSub.generateId("ToolError"),
              `Planning failed: ${errorMessage}`,
              "error",
            ),
          );
        return JSON.stringify(toolError(errorMessage)); // Return raw error
      }
    },
  });
}
