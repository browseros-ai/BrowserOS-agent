import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const KeyInputSchema = z.object({
  key: z
    .enum([
      "Enter",
      "Tab",
      "Escape",
      "Backspace",
      "Delete",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ])
    .describe("Keyboard key to press"),
});
type KeyInput = z.infer<typeof KeyInputSchema>;

export function KeyTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "key",
    description: "Send a keyboard key press",
    schema: KeyInputSchema,
    func: async (args: KeyInput) => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'key', 'start',
          `⌨️ Pressing ${args.key} key`,
          { args })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Pressing key...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.sendKeys(args.key);

        // Publish tool result event
        const duration = Date.now() - startTime
        context.publishTool(toolId, 'key', 'result',
          `✅ Pressed ${args.key} key`,
          { result: { ok: true }, duration })

        return JSON.stringify({
          ok: true,
          output: `Pressed ${args.key} key`,
        });
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'key', 'error',
          `❌ Key press failed: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Key press failed: ${errorMessage}`,
        });
      }
    },
  });
}
