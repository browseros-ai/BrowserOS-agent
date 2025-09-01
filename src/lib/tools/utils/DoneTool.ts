import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { toolSuccess, type ToolOutput } from "@/lib/tools/Tool.interface";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSub } from "@/lib/pubsub";

// Input schema - simple optional summary
const DoneInputSchema = z.object({
  reasoning: z.string().optional(), // Optional completion summary
});

type DoneInput = z.infer<typeof DoneInputSchema>;

// Factory function to create DoneTool
export function createDoneTool(
  executionContext: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "done_tool",
    description: "Mark task as complete",
    schema: DoneInputSchema,
    func: async (args: DoneInput): Promise<string> => {
      const summary = args.reasoning || "Task completed successfully";

      // Emit status message
      executionContext
        .getPubSub()
        .publishMessage(PubSub.createMessage(`${summary}`, "thinking"));

      return JSON.stringify(toolSuccess(summary));
    },
  });
}

// Observe tool schema
const ObserveInputSchema = z.object({
  reasoning: z.string().optional(), // Why observation is needed now
});

type ObserveInput = z.infer<typeof ObserveInputSchema>;

// Factory function to create ObserveTool
export function createObserveTool(
  executionContext: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "observe_tool",
    description:
      "Request to observe the current page state before continuing. Use this when you need to see the results of your actions or when the page might have changed.",
    schema: ObserveInputSchema,
    func: async (args: ObserveInput): Promise<string> => {
      const message = args.reasoning || "Observing current page state";

      // Emit status message
      executionContext
        .getPubSub()
        .publishMessage(PubSub.createMessage(`${message}`, "thinking"));

      return JSON.stringify(toolSuccess("observe: " + message));
    },
  });
}

// Continue tool schema
const ContinueInputSchema = z.object({
  reasoning: z.string().optional(), // Why continuing/what was accomplished so far
});

type ContinueInput = z.infer<typeof ContinueInputSchema>;

// Factory function to create ContinueTool
export function createContinueTool(
  executionContext: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "continue_tool",
    description:
      "Continue executing more actions without needing observation. Use this when you know exactly what to do next.",
    schema: ContinueInputSchema,
    func: async (args: ContinueInput): Promise<string> => {
      const message = args.reasoning || "Continuing with task execution";

      // Emit status message
      executionContext
        .getPubSub()
        .publishMessage(PubSub.createMessage(`${message}`, "thinking"));

      return JSON.stringify(toolSuccess("continue: " + message));
    },
  });
}

// Replan tool schema
const ReplanInputSchema = z.object({
  reasoning: z.string(), // Why replanning is needed
});

type ReplanInput = z.infer<typeof ReplanInputSchema>;

// Factory function to create ReplanTool
export function createReplanTool(
  executionContext: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "replan_tool",
    description:
      "Request replanning when the current plan isn't working or when unexpected situations arise. This will trigger a new planning phase.",
    schema: ReplanInputSchema,
    func: async (args: ReplanInput): Promise<string> => {
      // Emit status messages
      executionContext
        .getPubSub()
        .publishMessage(
          PubSub.createMessage(`Replanning needed: ${args.reasoning}`, "thinking"),
        );

      return JSON.stringify(toolSuccess("replan: " + args.reasoning));
    },
  });
}
