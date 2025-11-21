import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageType } from "@/lib/types/messaging";

/**
 * PdfExtractTool - Extract structured data from PDF documents
 *
 * FLOW:
 * 1. Agent calls PdfExtractTool with extraction parameters if it detects PDF context
 * 2. Tool gets current browser tab URL (assumes it's a PDF document)
 * 3. Tool resolves Chrome PDF viewer URLs to underlying PDF source
 * 4. Tool sends PDF_PARSE_REQUEST message to sidepanel via chrome.runtime.sendMessage
 * 5. Sidepanel's useMessageHandler receives message and delegates to PdfRequestHandler
 * 6. PdfRequestHandler coordinates processing using cached singleton services
 * 7. PdfProcessingService orchestrates the work:
 *    - PdfService loads PDF document using PDF.js v5.4.296
 *    - PdfExtractionService handles text/search/outline operations
 *    - Applies 50-page limits for performance protection
 * 8. Response flows back via PDF_PARSE_RESPONSE message
 * 9. Tool processes response and returns structured data to agent
 *
 * WHY THIS ARCHITECTURE?
 * - Chrome extensions cannot directly access cross-origin PDFs from content scripts
 * - PDF.js requires full extension permissions (available in sidepanel/background)
 * - Sidepanel provides isolated execution context with proper security boundaries
 * - Cross-process messaging enables communication between contexts
 *
 * Note:
 * - Execution-scoped caching: PDFs cached per agent execution to avoid reinitialization(max of 3 currently)
 * - Page limits: currently a 50-page maximum for text/search operations prevents resource exhaustion
 */
export function PdfExtractTool(context: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "pdf_extract",
    description: `Extract data from PDF documents. Supports both cost-effective raw extraction (no AI) and AI-powered structured extraction.

Raw extraction modes (no LLM cost):
- format={metadata: true} → Document metadata (title, author, page count)
- format={text: true} → Raw text content from pages
- format={find: {query: "search term"}} → Text search within PDF
- format={outline: true} → Document table of contents

AI-powered extraction (uses LLM):
- format={companies: [], ceos: []} → Structured data extraction with custom output format
- Requires 'task' parameter describing what to extract`,
    // TOOL SCHEMA DEFINITION
    schema: z.object({
      format: z.union([
        // RAW EXTRACTION MODES - No LLM cost, direct PDF.js operations
        z.object({
          metadata: z.boolean().optional().describe("Extract document metadata (title, author, page count) without AI processing"),
          text: z.boolean().optional().describe("Extract raw text content without AI processing"),
          outline: z.boolean().optional().describe("Extract document outline/bookmarks (table of contents) without AI processing"),
          find: z.object({
            query: z.string().describe("Search query to find in the PDF")
          }).optional().describe("Search for text matches within the PDF using PDF.js"),
        }).refine(obj => Object.keys(obj).length > 0, "Must specify at least one extraction format"),

        // AI-POWERED EXTRACTION MODE - Uses LLM for intelligent processing
        z.record(z.any()).describe("Arbitrary object defining desired output structure for AI-powered extraction")
      ]),

      // PAGE SELECTION PARAMETERS
      task: z
        .string()
        .optional()
        .describe("Description of what data to extract (required for AI-powered modes)"),

      // PAGE TARGETING - Multiple ways to specify which pages to process
      page: z
        .array(z.number())
        .optional()
        .describe("Specific page numbers to extract [1, 3, 5]"),

      pages: z
        .union([
          z.enum(["all"]),  // Using enum instead of literal for Gemini API compatibility (Gemini doesn't support JSON Schema "const" keyword)
          z.object({
            start: z.number(),
            end: z.number()
          }).describe("Page range {start: 1, end: 10}")
        ])
        .optional()
        .describe("Page selection: 'all' for entire document, or {start: 1, end: 10} for range"),
    }),

    /**
     * MAIN TOOL EXECUTION FUNCTION
     *
     * This is the core logic that orchestrates the entire PDF extraction process.
     * It handles parameter validation, URL resolution, cross-process messaging,
     * response processing, and result formatting.
     *
     * EXECUTION FLOW:
     * 1. Validate parameters and increment usage metrics
     * 2. Get current page URL and resolve PDF viewer URLs
     * 3. Ensure sidepanel is open and initialized
     * 4. Send request to sidepanel for processing
     * 5. Wait for async response with timeout protection
     * 6. Route response to appropriate handler based on extraction mode
     * 7. Return formatted results to the agent
     */
    func: async ({ format, task, page, pages }) => {
      try {
        // METRICS TRACKING - Monitor tool usage for analytics and optimization
        context.incrementMetric("toolCalls");

        /**
         * STEP 1: GET CURRENT PAGE CONTEXT
         *
         * The tool assumes the agent is currently viewing a PDF document. (because agent chose pdf tool)
         * We get the current page details to extract the PDF URL.
         */
        const currentPage = await context.browserContext.getCurrentPage();
        const pageDetails = await currentPage.getPageDetails();
        let parseUrl = pageDetails.url;

        /**
         * STEP 2: RESOLVE PDF VIEWER URLS
         *
         * Chrome's built-in PDF viewer uses URLs like:
         * chrome-extension://extension-id/pdf-viewer.html?src=https://example.com/document.pdf
         *
         * We need to extract the actual PDF URL from the 'src' parameter.
         * This ensures we process the underlying PDF, not the viewer page.
         */
        try {
          const u = new URL(pageDetails.url);
          if (u.protocol === 'chrome-extension:') {
            const srcParam = u.searchParams.get('src');
            if (srcParam) parseUrl = decodeURIComponent(srcParam);
          }
        } catch (_error) {
          // If URL parsing fails, use the original URL as fallback
        }

        /**
         * STEP 3: ENSURE SIDEPANEL IS OPEN
         *
         * The sidepanel needs to be open for PDF processing to work.
         * We open it programmatically and give it time to initialize.
         * This is non-fatal - if already open, this is a no-op.
         */
        try {
          await chrome.sidePanel.open({ tabId: currentPage.tabId });
          // INITIALIZATION DELAY - Allow sidepanel time to set up PDF services
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          console.log('[PdfExtractTool] Could not open side panel:', e);
          // Non-fatal - side panel might already be open
        }

        /**
         * STEP 4: SEND REQUEST TO SIDEPANEL FOR PROCESSING
         *
         * Due to Chrome extension security model, PDF processing must happen in the sidepanel
         * (or background script) where we have full permissions. We use Chrome's messaging API
         * to communicate between the content script context (where the agent runs) and the
         * sidepanel context (where PDF.js can operate).
         *
         * MESSAGE FLOW:
         * Content Script → Background Router → Sidepanel → PDF Services → Response
         */
        console.log('[PdfExtractTool] Starting PDF parsing for URL:', parseUrl, 'pages param:', pages);

        // CROSS-PROCESS MESSAGING WITH PROMISE-BASED ASYNC HANDLING
        const pdfData = await new Promise<any>((resolve, reject) => {
          // TIMEOUT PROTECTION - Prevent hanging requests (15 seconds is generous for PDF operations)
          const timeout = setTimeout(() => {
            console.log('[PdfExtractTool] PDF parsing timeout');
            reject(new Error('PDF sidepanel parse timeout'));
          }, 15000);

          // UNIQUE REQUEST ID - Ensures responses are matched to correct requests
          // Format: pdf_parse_{timestamp}_{random_suffix}
          const requestId = `pdf_parse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          console.log('[PdfExtractTool] Generated request ID:', requestId);

          /**
           * RESPONSE LISTENER SETUP
           *
           * We set up a Chrome runtime message listener to receive the PDF_PARSE_RESPONSE.
           * The listener matches responses by requestId to ensure we get the right data.
           * Once matched, we clean up the listener and resolve/reject the promise.
           */
          const responseListener = (response: any) => {
            console.log('[PdfExtractTool] Received message:', response?.type, response?.requestId);

            // MATCH RESPONSE TO OUR REQUEST using unique requestId
            if (response?.type === MessageType.PDF_PARSE_RESPONSE && response.requestId === requestId) {
              // SUCCESS RESPONSE VALIDATION
              clearTimeout(timeout);
              chrome.runtime.onMessage.removeListener(responseListener);
              console.log('[PdfExtractTool] Matched response for request:', requestId);

              if (response.ok === true && (response.pages || response.metadata || response.searchResults)) {
                console.log('[PdfExtractTool] PDF parsing successful, pages extracted:', response.pages?.length || 'metadata only');
                resolve(response);
              } else {
                console.log('[PdfExtractTool] PDF parsing failed:', response.error);
                reject(new Error(response.error || 'Sidepanel parse failed'));
              }
            }
          };

          // REGISTER THE RESPONSE LISTENER
          chrome.runtime.onMessage.addListener(responseListener);

          try {
            /**
             * SEND PDF_PARSE_REQUEST TO SIDEPANEL
             *
             * Payload includes all necessary information for PDF processing:
             * - url: The resolved PDF URL to process
             * - page/pages: Page selection parameters
             * - format: Extraction format specification
             * - executionId: For caching coordination in sidepanel
             */
            const payload = {
              url: parseUrl,
              page: page,
              pages: pages,
              format: format,
              executionId: context.executionId // Enables execution-scoped caching
            };
            console.log('[PdfExtractTool] Sending PDF_PARSE_REQUEST with payload:', payload);

            // SEND MESSAGE TO SIDEPANEL VIA CHROME RUNTIME
            chrome.runtime.sendMessage({
              type: MessageType.PDF_PARSE_REQUEST,
              requestId,
              payload
            });

          } catch (e) {
            // CLEANUP ON SEND FAILURE
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(responseListener);
            console.log('[PdfExtractTool] Error sending request:', e);
            reject(e as Error);
          }
        });

        /**
         * STEP 5: FORMAT DETECTION HELPER
         *
         * Determines if the requested format is a raw extraction mode (no LLM cost)
         * vs an AI-powered mode (requires LLM processing).
         *
         * Raw modes: metadata, text, outline, find (direct PDF.js operations)
         * AI modes: Any other object structure (requires LLM for intelligent extraction)
         */
        const isRawMode = (format: any): boolean => {
          const rawKeys = ['metadata', 'text', 'outline', 'find'];
          const formatKeys = Object.keys(format);
          return formatKeys.length > 0 && formatKeys.every(key => rawKeys.includes(key));
        };

        /**
         * STEP 6: PROCESS RESPONSE BASED ON EXTRACTION MODE
         *
         * Route the response to the appropriate handler based on whether it's
         * raw extraction or AI-powered extraction. Each mode has different
         * processing requirements and output formatting.
         */

        // RAW METADATA EXTRACTION HANDLER
        if (isRawMode(format) && format.metadata && pdfData.metadata) {
          return JSON.stringify({
            ok: true,
            output: pdfData.metadata,
            metadata: {
              url: parseUrl,
              title: pageDetails.title,
              pagesExtracted: [], // Metadata extraction doesn't process pages
              totalPagesInDocument: pdfData.totalPages
            }
          });
        }

        // RAW TEXT EXTRACTION HANDLER
        if (isRawMode(format) && format.text && pdfData.pages) {
          // FORMAT TEXT OUTPUT - Group by page with clear separators
          const rawText = pdfData.pages.map((p: any) =>
            `--- Page ${p.pageNumber} ---\n${p.text}`
          ).join('\n\n');

          // PAGE LIMIT NOTIFICATION - Inform user if pages were capped
          const limitNote = pdfData.limitApplied ?
            `\n\n[Note: ${pdfData.limitApplied.reason}. Processed ${pdfData.limitApplied.pagesProcessed} of ${pdfData.limitApplied.originalPagesRequested} requested pages.]` : '';

          return JSON.stringify({
            ok: true,
            output: rawText + limitNote,
            metadata: {
              url: parseUrl,
              title: pageDetails.title,
              pagesExtracted: pdfData.pages.map((p: any) => p.pageNumber),
              totalPagesInDocument: pdfData.totalPages,
              limitApplied: pdfData.limitApplied
            }
          });
        }

        // RAW SEARCH RESULTS HANDLER
        if (isRawMode(format) && format.find && pdfData.searchResults) {
          return JSON.stringify({
            ok: true,
            output: pdfData.searchResults,
            metadata: {
              url: parseUrl,
              title: pageDetails.title,
              searchQuery: format.find.query,
              totalMatches: pdfData.searchResults.length,
              totalPagesInDocument: pdfData.totalPages
            }
          });
        }

        // RAW OUTLINE EXTRACTION HANDLER
        if (isRawMode(format) && format.outline && pdfData.outline) {
          return JSON.stringify({
            ok: true,
            output: pdfData.outline,
            metadata: {
              url: parseUrl,
              title: pageDetails.title,
              pagesExtracted: [], // Outline extraction doesn't process pages
              totalPagesInDocument: pdfData.totalPages
            }
          });
        }

        /**
         * STEP 7: AI-POWERED EXTRACTION HANDLER
         *
         * For custom format objects or when raw mode detection doesn't apply,
         * we use the LLM to intelligently extract structured data from the PDF content.
         *
         * This mode is more expensive (uses LLM tokens) but provides intelligent
         * data extraction based on user requirements.
         */
        const llm = await context.getLLM({
          temperature: 0.1, // Low temperature for consistent extraction
          maxTokens: 8000, // Allow substantial output for structured data
        });

        /**
         * SYSTEM PROMPT FOR AI EXTRACTION
         *
         * Instructs the LLM to act as a data extraction specialist.
         * Emphasizes returning ONLY valid JSON without explanations.
         */
        const systemPrompt = `You are a data extraction specialist. Extract the requested information from the PDF content and return it in the exact JSON structure provided.

Important: Return ONLY valid JSON, no explanations or markdown.`;

        /**
         * BUILD CONTENT FOR LLM PROCESSING
         *
         * Convert the structured page data into a readable format for the LLM.
         * Each page is clearly marked with page numbers for context.
         */
        const pageContent = pdfData.pages.map((p: any) =>
          `--- Page ${p.pageNumber} ---\n${p.text}`
        ).join('\n\n');

        /**
         * USER PROMPT CONSTRUCTION
         *
         * Provides the LLM with:
         * - Task description (what to extract)
         * - Desired output format (JSON structure to match)
         * - PDF content organized by pages
         * - Clear instructions to extract and format the data
         */
        const outputFormat = format;
        const userPrompt = `Task: ${task || 'Extract information from the PDF'}

Desired output format:
${JSON.stringify(outputFormat, null, 2)}

PDF content (pages ${pdfData.pages.map((p: any) => p.pageNumber).join(', ')}):
${pageContent}

Extract the requested data and return it matching the exact structure of the format provided.`;

        /**
         * LLM PROCESSING - Execute the extraction
         *
         * Send the system prompt and user prompt to the LLM for processing.
         * The LLM will analyze the PDF content and extract structured data.
         */
        const llmResponse = await llm.invoke([
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]);

        /**
         * RESPONSE PROCESSING AND VALIDATION
         *
         * Parse the LLM response, clean it up, and validate it's valid JSON.
         * Handle parsing errors gracefully with detailed error messages.
         */
        try {
          const content = llmResponse.content as string;

          // CLEAN UP LLM RESPONSE - Remove markdown formatting if present
          const cleanedContent = content
            .replace(/```json\s*/gi, "") // Remove JSON code block markers
            .replace(/```\s*/g, "") // Remove generic code block markers
            .trim();

          // PARSE AND VALIDATE JSON RESPONSE
          const extractedData = JSON.parse(cleanedContent);

          // ADD LIMIT NOTIFICATION if page limits were applied
          const limitNote = pdfData.limitApplied ?
            `\n\n[Note: ${pdfData.limitApplied.reason}. Processed ${pdfData.limitApplied.pagesProcessed} of ${pdfData.limitApplied.originalPagesRequested} requested pages.]` : '';

          // SUCCESS RESPONSE FORMATTING
          return JSON.stringify({
            ok: true,
            output: extractedData,
            metadata: {
              url: parseUrl,
              title: pageDetails.title,
              pagesExtracted: pdfData.pages.map((p: any) => p.pageNumber),
              totalPagesInDocument: pdfData.totalPages,
              limitApplied: pdfData.limitApplied
            },
            note: limitNote ? limitNote.trim() : undefined
          });

        } catch (parseError) {
          // LLM RESPONSE PARSING ERROR HANDLING
          return JSON.stringify({
            ok: false,
            error: `Failed to parse extraction result as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
          });
        }

      } catch (error) {
        /**
         * TOP-LEVEL ERROR HANDLER
         *
         * Catches any unexpected errors in the entire PDF extraction process.
         * This is the final safety net that ensures we always return a valid response.
         */
        return JSON.stringify({
          ok: false,
          error: `PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    },
  });
}