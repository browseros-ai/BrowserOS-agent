import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { Logging } from "@/lib/utils/Logging";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export function ExtractTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "extract",
    description:
      "Extract structured data from current page using AI. Provide a JSON format object and description of what to extract.",
    schema: z.object({
      format: z
        .any()
        .describe(
          "JSON object showing desired output structure (e.g., {title: '', price: 0, items: []})",
        ),
      task: z
        .string()
        .describe("Description of what data to extract from the page"),
      extractionMode: z
        .enum(['text', 'text-with-links'])
        .optional()
        .default('text')
        .describe("Extraction mode: 'text' for content only, 'text-with-links' to include links section"),
    }),
    func: async ({ format, task, extractionMode = 'text' }: { format: any; task: string; extractionMode?: 'text' | 'text-with-links' }) => {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      const startTime = Date.now()

      try {
        context.incrementMetric("toolCalls");

        // Publish tool start event
        context.publishTool(toolId, 'extract', 'start',
          `📊 Extracting data: ${task}`,
          { args: { format, task, extractionMode } })

        // Also publish to old system for backward compatibility
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Extracting data from page...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Get page details
        const pageDetails = await page.getPageDetails();

        // Get hierarchical text content
        const hierarchicalContent = await page.getHierarchicalText();

        // Get links only if extraction mode includes links
        const linksContent = extractionMode === 'text-with-links'
          ? await page.getLinksSnapshotString()
          : null;

        // Determine content limit based on message manager's max tokens
        const maxTokens = context.messageManager.getMaxTokens();
        let contentCharLimit: number;

        if (maxTokens >= 1000000) {
          // 1M+ tokens: no limit
          contentCharLimit = Number.MAX_SAFE_INTEGER;
        } else if (maxTokens >= 200000) {
          // 200K+ tokens: 100K char limit
          contentCharLimit = 100000;
        } else {
          // Less than 200K tokens: 16K char limit (≈4K tokens)
          contentCharLimit = 16000;
        }

        // Get LLM instance
        const llm = await context.getLLM({
          temperature: 0.1,
          maxTokens: 8000,
        });

        // Create extraction prompt
        const systemPrompt =
          "You are a data extraction specialist. Extract the requested information from the page content and return it in the exact JSON structure provided.";

        // Prepare content with truncation if needed
        const preparedContent = contentCharLimit === Number.MAX_SAFE_INTEGER ||
                                hierarchicalContent.length <= contentCharLimit
          ? hierarchicalContent
          : hierarchicalContent.substring(0, contentCharLimit) + "\n...[truncated]";

        // Build prompt with hierarchical content
        let userPrompt = `Task: ${task}

Desired output format:
${JSON.stringify(format, null, 2)}

Page content:
URL: ${pageDetails.url}
Title: ${pageDetails.title}

Content (hierarchical structure with tab indentation):
${preparedContent}`;

        // Add links section if requested
        if (extractionMode === 'text-with-links' && linksContent) {
          userPrompt += `\n\nLinks found:
${linksContent.substring(0, 2000)}${linksContent.length > 2000 ? "\n...[more links]" : ""}`;
        }

        userPrompt += `\n\nExtract the requested data and return it matching the exact structure of the format provided.`;

        Logging.log(
          "NewAgent",
          `Extracting data with format: ${JSON.stringify(format)}, mode: ${extractionMode}`,
          "info",
        );

        // Just invoke LLM without structured output - let it figure out the JSON
        const response = await llm.invoke([
          new SystemMessage(
            systemPrompt +
            "\n\nIMPORTANT: Return ONLY valid JSON, no explanations or markdown."
          ),
          new HumanMessage(userPrompt),
        ]);

        // Try to parse the JSON response
        try {
          const content = response.content as string;
          // Clean up response - remove markdown code blocks if present
          const cleanedContent = content
            .replace(/```json\s*/gi, "")
            .replace(/```\s*/g, "")
            .trim();

          const extractedData = JSON.parse(cleanedContent);

          // Publish tool result event
          const duration = Date.now() - startTime
          context.publishTool(toolId, 'extract', 'result',
            `✅ Data extracted successfully`,
            { result: { ok: true }, duration })

          return JSON.stringify({
            ok: true,
            output: extractedData,
          });
        } catch (parseError) {
          // If parsing fails, return the raw response with an error
          const duration = Date.now() - startTime
          const errorMsg = `Failed to parse extraction result as JSON`
          context.publishTool(toolId, 'extract', 'error',
            `❌ ${errorMsg}`,
            { error: errorMsg, duration })

          return JSON.stringify({
            ok: false,
            error: `${errorMsg}. Raw output: ${response.content}`,
          });
        }
      } catch (error) {
        context.incrementMetric("errors");

        // Publish tool error event
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.publishTool(toolId, 'extract', 'error',
          `❌ Extraction failed: ${errorMessage}`,
          { error: errorMessage, duration })

        return JSON.stringify({
          ok: false,
          error: `Extraction failed: ${errorMessage}`,
        });
      }
    },
  });
}
