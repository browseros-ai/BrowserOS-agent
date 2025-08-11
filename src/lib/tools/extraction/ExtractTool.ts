import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { toolError } from '@/lib/tools/Tool.interface'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { generateExtractorSystemPrompt, generateExtractorTaskPrompt } from './ExtractTool.prompt'
import { invokeWithRetry } from '@/lib/utils/retryable'
import { MessageType } from '@/lib/types/messaging'

// Input schema for extraction
const ExtractInputSchema = z.object({
  task: z.string(),  // What to extract (e.g., "Extract all product prices")
  tab_id: z.number(),  // Tab ID to extract from
  extract_type: z.enum(['links', 'text'])  // Type of content to extract
})

// Output schema for extracted data
const ExtractedDataSchema = z.object({
  content: z.string(),  // The LLM's extracted/summarized/rephrased output
  reasoning: z.string()  // LLM's explanation of what it did, found, and created
})

type ExtractInput = z.infer<typeof ExtractInputSchema>
type ExtractedData = z.infer<typeof ExtractedDataSchema>

const DEFAULT_MAX_PDF_PAGES = 40

// Factory function to create ExtractTool
export function createExtractTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const ToolCtor = DynamicStructuredTool as unknown as new (config: any) => DynamicStructuredTool
  return new ToolCtor({
    name: 'extract_tool',
    description: 'Extract specific information from a web page using AI. Supports extracting text or links based on a task description.',
    schema: ExtractInputSchema,
    func: async (args: ExtractInput): Promise<string> => {
      // Track last known URL for failure recording
      let lastKnownUrl: string | undefined
      try {
        // Get the page for the specified tab, fallback to current page
        const requestedTabId = Number.isInteger(args.tab_id) && args.tab_id > 0 ? args.tab_id : undefined
        let pages = await executionContext.browserContext.getPages(requestedTabId ? [requestedTabId] : undefined)
        if (!pages || pages.length === 0) {
          const currentPage = await executionContext.browserContext.getCurrentPage()
          pages = currentPage ? [currentPage] : []
        }
        if (!pages || pages.length === 0) {
          return JSON.stringify(toolError(`Tab ${args.tab_id} not found and no current tab available`))
        }
        let page = pages[0]

        // Preload page metadata
        let url = await page.url()
        lastKnownUrl = url
        let title = await page.title()

        // Infer page limit from task text (e.g., "first 6 pages", "pages 1-6")
        const inferMaxPages = (taskText: string): number | undefined => {
          const lower = taskText.toLowerCase()
          const m1 = lower.match(/first\s+(\d{1,3})\s+pages?/) // first 6 pages
          if (m1 && m1[1]) return Math.max(1, Math.min(100, parseInt(m1[1], 10)))
          const m2 = lower.match(/pages?\s+(\d{1,3})\s*[-–]\s*(\d{1,3})/) // pages 1-6
          if (m2 && m2[1] && m2[2]) {
            const start = parseInt(m2[1], 10)
            const end = parseInt(m2[2], 10)
            if (!isNaN(start) && !isNaN(end) && end >= start) return Math.max(1, Math.min(100, end - start + 1))
          }
          return undefined
        }
        const maxPagesHint = inferMaxPages(args.task)

        // Get raw content; unify to side panel pdf.js only for PDFs, generic snapshots for HTML
        let rawContent: string
        
        // Ensure we are on a PDF tab by capability (no URL patterns)
        let isPdf = await (page as any).isPdf?.()
        if (!isPdf) {
          try {
            const allTabs = await executionContext.browserContext.getTabs()
            const pagesForTabs = await executionContext.browserContext.getPages(allTabs.map(t => t.id))
            const findPdfPage = async (): Promise<any | null> => {
              for (const p of pagesForTabs) {
                try {
                  if (await (p as any).isPdf?.()) return p
                  const pc = await (p as any).getPdfPageCount?.().catch(() => 0)
                  if (typeof pc === 'number' && pc > 0) return p
                } catch {}
              }
              return null
            }
            let pdfPage = await findPdfPage()
            if (!pdfPage) {
              const deadline = Date.now() + 2000
              while (!pdfPage && Date.now() < deadline) {
                await new Promise(r => setTimeout(r, 200))
                const tabs2 = await executionContext.browserContext.getTabs()
                const pages2 = await executionContext.browserContext.getPages(tabs2.map(t => t.id))
                for (const p2 of pages2) {
                  try {
                    if (await (p2 as any).isPdf?.()) { pdfPage = p2; break }
                    const pc2 = await (p2 as any).getPdfPageCount?.().catch(() => 0)
                    if (typeof pc2 === 'number' && pc2 > 0) { pdfPage = p2; break }
                  } catch {}
                }
              }
            }
            if (pdfPage) {
              page = pdfPage
              url = await page.url()
              lastKnownUrl = url
              title = await page.title()
              isPdf = true
            }
          } catch {}
        }
        
        if (isPdf) {
          // Unified: delegate to side panel pdf.js via URL-only request (text-only). Single retry.
          // Give newly opened viewer a brief moment to stabilize
          await new Promise(r => setTimeout(r, 900))
          // Resolve viewer URLs (chrome-extension) to underlying PDF src when possible
          let parseUrl = url
          try {
            const u = new URL(url)
            if (u.protocol === 'chrome-extension:') {
              const srcParam = u.searchParams.get('src')
              if (srcParam) parseUrl = decodeURIComponent(srcParam)
            }
          } catch {}
          const sendParse = () => new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('PDF sidepanel parse timeout')), 15000)
            try {
              chrome.runtime.sendMessage({ type: MessageType.PDF_PARSE_REQUEST, payload: { url: parseUrl, maxPages: maxPagesHint ?? DEFAULT_MAX_PDF_PAGES } }, (resp?: { ok?: boolean; text?: string; error?: string }) => {
                clearTimeout(timeout)
                const lastErr = chrome.runtime.lastError
                if (lastErr) return reject(new Error(lastErr.message))
                if (!resp || resp.ok !== true || !resp.text) return reject(new Error(resp?.error || 'Sidepanel parse failed'))
                resolve(resp.text)
              })
            } catch (e) {
              clearTimeout(timeout)
              reject(e as Error)
            }
          })
          try {
            rawContent = await sendParse()
          } catch (firstErr) {
            await new Promise(r => setTimeout(r, 1200))
            try {
              rawContent = await sendParse()
            } catch (secondErr) {
              await new Promise(r => setTimeout(r, 1500))
              rawContent = await sendParse()
            }
          }
          // We no longer know total page count reliably here; omit it
        } else if (args.extract_type === 'text') {
          const textSnapshot = await page.getTextSnapshot()
          const maybeSections: unknown = (textSnapshot as any)?.sections
          const sections: any[] = Array.isArray(maybeSections) ? maybeSections : []
          if (sections.length > 0) {
            const parts: string[] = []
            for (const section of sections) {
              const piece = (section && (section.content || section.text)) ? (section.content || section.text) : JSON.stringify(section)
              parts.push(typeof piece === 'string' ? piece : String(piece))
            }
            rawContent = parts.join('\n')
          } else {
            rawContent = 'No text content found'
          }
        } else {
          const linksSnapshot = await page.getLinksSnapshot()
          const maybeSections: unknown = (linksSnapshot as any)?.sections
          const sections: any[] = Array.isArray(maybeSections) ? maybeSections : []
          if (sections.length > 0) {
            const parts: string[] = []
            for (const section of sections) {
              const piece = (section && (section.content || section.text)) ? (section.content || section.text) : JSON.stringify(section)
              parts.push(typeof piece === 'string' ? piece : String(piece))
            }
            rawContent = parts.join('\n')
          } else {
            rawContent = 'No links found'
          }
        }
        
        // Get LLM instance
        const llm = await executionContext.getLLM({temperature: 0.1})
        
        // Generate prompts
        const systemPrompt = generateExtractorSystemPrompt()
        const taskPrompt = generateExtractorTaskPrompt(
          args.task,
          args.extract_type,
          rawContent,
          { url, title }
        )
        
        // Get structured response from LLM with retry logic
        const structuredLLM = llm.withStructuredOutput(ExtractedDataSchema)
        const extractedData = await invokeWithRetry<ExtractedData>(
          structuredLLM,
          [
            new SystemMessage(systemPrompt),
            new HumanMessage(taskPrompt)
          ],
          3
        )
        
        // Return success result
        const output = isPdf
          ? {
              pdf: { url, title },
              content: extractedData.content,
              reasoning: extractedData.reasoning
            }
          : extractedData

        return JSON.stringify({
          ok: true,
          output
        })
      } catch (error) {
        // Handle error
        const errorMessage = error instanceof Error ? error.message : String(error)
        try {
          // Attempt to record the last known URL as failed
          if (lastKnownUrl) executionContext.addFailedUrl(lastKnownUrl)
        } catch {}
        return JSON.stringify(toolError(`Extraction failed: ${errorMessage}`))
      }
    }
  })
}
