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
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Pressing key...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.sendKeys(args.key);

        return JSON.stringify({
          ok: true,
          output: `Pressed ${args.key} key`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Key press failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
