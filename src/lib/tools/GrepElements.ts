import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";

const GrepElementsInputSchema = z.object({
  pattern: z.string().describe("Regex pattern to search for (e.g., 'button.*login', 'input.*(email|user)')"),
  limit: z.number().int().min(1).optional().default(15)
    .describe("Maximum number of results to return (default: 15)"),
});
type GrepElementsInput = z.infer<typeof GrepElementsInputSchema>;

export function GrepElementsTool(context: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "grep_elements",
    description: `Search page elements using regex patterns. Browser state format: [nodeId] <C/T> <tag> "text" attributes

COMMON PATTERNS:
- Text search: "login|sign.?in" (flexible login text)
- Buttons: "button.*submit|input.*submit" (submit buttons)
- Inputs: "input.*(email|user|name)" (form fields)
- Links: "a.*href.*shop" (links containing 'shop')
- IDs: "\\\\[\\\\d+\\\\].*login" (any element with 'login')
- Attributes: 'type="email"|placeholder.*email' (email fields)

EXAMPLE: [42] <C> <button> "Submit" class="btn-primary"
Returns max 15 matches, shows total count if more exist.`,
    schema: GrepElementsInputSchema,
    func: async (args: GrepElementsInput) => {
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Searching with pattern "${args.pattern}"...`, "thinking")
        );

        // Validate pattern
        let regex: RegExp;
        try {
          regex = new RegExp(args.pattern, 'i');  // Case-insensitive by default
        } catch (regexError) {
          return JSON.stringify({
            ok: false,
            error: `Invalid regex pattern: ${regexError instanceof Error ? regexError.message : String(regexError)}`
          });
        }

        // Get browser state string to parse
        const browserState = await context.browserContext.getBrowserStateString();
        const lines = browserState.split('\n');

        // Find all matching lines by applying regex at line level
        const matchingLines: string[] = [];
        for (const line of lines) {
          // Skip empty lines
          if (line.trim() === '') continue;

          // Apply regex to the full line
          if (regex.test(line)) {
            matchingLines.push(line.trim());
          }
        }

        // Limit to 15 matches
        const totalMatches = matchingLines.length;
        const limitedMatches = matchingLines.slice(0, args.limit);

        if (limitedMatches.length === 0) {
          return JSON.stringify({
            ok: false,
            error: `No elements found matching pattern "${args.pattern}". Try broader patterns like 'button', 'input', or check browser state format.`
          });
        }

        // Format results - just return the matching lines joined
        const truncationMessage = totalMatches > 15
          ? `\n\nShowing first 15 of ${totalMatches} matches.`
          : '';

        return JSON.stringify({
          ok: true,
          output: `${limitedMatches.join('\n')}${truncationMessage}`
        });

      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Grep elements failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}
