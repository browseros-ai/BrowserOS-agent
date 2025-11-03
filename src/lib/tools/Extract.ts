import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { Logging } from "@/lib/utils/Logging";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getFeatureFlags } from "@/lib/utils/featureFlags";
import type { BrowserPage } from "@/lib/browser/BrowserPage";

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
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Extracting data from page...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Get page details
        const pageDetails = await page.getPageDetails();

        // Get page content based on format (checks feature flag internally)
        const { mainContent, linksContent } = await _getPageContent(page, extractionMode);

        // Determine content limit
        const contentCharLimit = _getContentLimit(context.messageManager.getMaxTokens());

        // Prepare content with truncation
        const preparedContent = _prepareContent(mainContent, contentCharLimit);

        // Build extraction prompt
        const userPrompt = _buildPrompt(
          task,
          format,
          pageDetails,
          preparedContent,
          linksContent,
          extractionMode
        );

        Logging.log(
          "ExtractTool",
          `Extracting data (mode: ${extractionMode})`,
          "info",
        );

        // Get LLM and invoke extraction
        const llm = await context.getLLM({
          temperature: 0.1,
          maxTokens: 8000,
        });

        const response = await llm.invoke([
          new SystemMessage(
            "You are a data extraction specialist. Extract the requested information from the page content and return it in the exact JSON structure provided.\n\nIMPORTANT: Return ONLY valid JSON, no explanations or markdown."
          ),
          new HumanMessage(userPrompt),
        ]);

        // Parse and return result
        return _parseExtractionResult(response.content as string);

      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// ============= Helper Functions =============

/**
 * Get page content based on extraction mode
 * BrowserPage methods automatically handle both old and new snapshot formats
 */
async function _getPageContent(
  page: BrowserPage,
  extractionMode: 'text' | 'text-with-links'
): Promise<{ mainContent: string; linksContent: string | null }> {
  // Check feature flag
  const featureFlags = getFeatureFlags();
  const useNewFormat = featureFlags.isEnabled('NEW_SNAPSHOT_FORMAT');

  if (useNewFormat) {
    // New format: unified methods handle both formats internally
    if (extractionMode === 'text-with-links') {
      const content = await page.getTextWithLinksString();
      return { mainContent: content, linksContent: null };  // Links already included
    } else {
      const content = await page.getTextSnapshotString();
      return { mainContent: content, linksContent: null };
    }
  } else {
    // Old format: hierarchical text and separate links
    const mainContent = await page.getHierarchicalText();
    const linksContent = extractionMode === 'text-with-links'
      ? await page.getLinksSnapshotString()
      : null;
    return { mainContent, linksContent };
  }
}

/**
 * Determine content character limit based on max tokens
 */
function _getContentLimit(maxTokens: number): number {
  if (maxTokens >= 1000000) {
    return Number.MAX_SAFE_INTEGER;  // No limit for 1M+ tokens
  } else if (maxTokens >= 200000) {
    return 100000;  // 100K chars for 200K+ tokens
  } else {
    return 16000;  // 16K chars for <200K tokens
  }
}

/**
 * Prepare content with truncation if needed
 */
function _prepareContent(content: string, limit: number): string {
  if (limit === Number.MAX_SAFE_INTEGER || content.length <= limit) {
    return content;
  }
  return content.substring(0, limit) + "\n...[truncated]";
}

/**
 * Build extraction prompt
 */
function _buildPrompt(
  task: string,
  format: any,
  pageDetails: { url: string; title: string; tabId: number },
  preparedContent: string,
  linksContent: string | null,
  extractionMode: 'text' | 'text-with-links'
): string {
  // Check feature flag
  const featureFlags = getFeatureFlags();
  const useNewFormat = featureFlags.isEnabled('NEW_SNAPSHOT_FORMAT');

  const contentLabel = useNewFormat
    ? "Content (markdown format with headings and links):"
    : "Content (hierarchical structure with tab indentation):";

  let prompt = `Task: ${task}

Desired output format:
${JSON.stringify(format, null, 2)}

Page content:
URL: ${pageDetails.url}
Title: ${pageDetails.title}

${contentLabel}
${preparedContent}`;

  // Add links section only for old format with separate links
  if (!useNewFormat && extractionMode === 'text-with-links' && linksContent) {
    prompt += `\n\nLinks found:
${linksContent.substring(0, 2000)}${linksContent.length > 2000 ? "\n...[more links]" : ""}`;
  }

  prompt += `\n\nExtract the requested data and return it matching the exact structure of the format provided.`;

  return prompt;
}

/**
 * Parse extraction result from LLM response
 */
function _parseExtractionResult(content: string): string {
  try {
    // Clean up response - remove markdown code blocks if present
    const cleanedContent = content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const extractedData = JSON.parse(cleanedContent);

    return JSON.stringify({
      ok: true,
      output: extractedData,
    });
  } catch (parseError) {
    return JSON.stringify({
      ok: false,
      error: `Failed to parse extraction result as JSON. Raw output: ${content}`,
    });
  }
}
