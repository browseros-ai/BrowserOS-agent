import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { toolError } from '@/lib/tools/Tool.interface'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { generateExtractorSystemPrompt, generateExtractorTaskPrompt } from './ExtractTool.prompt'
import { invokeWithRetry } from '@/lib/utils/retryable'
import { MessageType } from '@/lib/types/messaging'
import { Logging } from '@/lib/utils/Logging'

// Input schema for extraction
const ExtractInputSchema = z.object({
  task: z.string(),                                           // What to extract (e.g., 'Extract all product prices')
  tab_id: z.number(),                                         // Tab ID to extract from
  extract_type: z.enum(['links', 'text']),                    // Type of content to extract
  max_pages: z.number().int().positive().max(100).optional()  // For PDFs, upper bound of pages to parse
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

        // Preload page metadata (fresh from Chrome to avoid stale cache)
        const getFreshUrl = async (p: any): Promise<string> => {
          try {
            const tab = await chrome.tabs.get(p.tabId)
            return tab.url || ''
          } catch {
            try { return typeof p.url === 'function' ? p.url() : '' } catch { return '' }
          }
        }
        let url = await getFreshUrl(page)
        lastKnownUrl = url
        let title = await page.title()

        // Use provided page upper bound for PDFs when available
        const maxPagesHint = args.max_pages

        // Get raw content; unify to side panel pdf.js only for PDFs, generic snapshots for HTML
        let rawContent: string = ''
        
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
                } catch (error) {
                  // Non-fatal: continue scanning other tabs
                }
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
                  } catch (error) {
                    // Non-fatal during scan
                  }
                }
              }
            }
            if (pdfPage) {
              page = pdfPage
              url = await getFreshUrl(page)
              lastKnownUrl = url
              title = await page.title()
              isPdf = true
            }
          } catch (error) {
            // Accept fallback to non-PDF path silently
          }
        }
        
        if (isPdf) {
          // Debug helper
          const PDF_DEBUG = true
          const dbg = (msg: string): void => { if (PDF_DEBUG) Logging.log('PDF', `[ExtractTool] ${msg}`, 'info') }
          dbg(`start tab=${args.tab_id} url=${url}`)
          // Resolve viewer URLs (chrome-extension) to underlying PDF src when possible
          let parseUrl = url
          try {
            const u = new URL(url)
            if (u.protocol === 'chrome-extension:') {
              const srcParam = u.searchParams.get('src')
              if (srcParam) parseUrl = decodeURIComponent(srcParam)
            }
          } catch (_error) { /* ignore parse issues */ }
          

          // Ensure side panel is open and ready to handle PDF parsing via port bridge
          const sleep = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms))
          const ensureSidePanelOpen = async (): Promise<void> => {
            try {
              const tabId = Number.isInteger(args.tab_id) && args.tab_id > 0 ? args.tab_id : undefined
              if (tabId !== undefined) {
                await chrome.sidePanel.open({ tabId })
              }
            } catch (_e) { /* best-effort: ignore */ }
          }

          // Delegate parsing to side panel UI to avoid ServiceWorker import() limitations
          const sendParse = (override?: { bytesBase64?: string }) => new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('PDF sidepanel parse timeout')), 15000)
            try {
              const payload: any = { url: parseUrl, maxPages: maxPagesHint ?? DEFAULT_MAX_PDF_PAGES, ...(override || {}) }
              chrome.runtime.sendMessage({ type: MessageType.PDF_PARSE_REQUEST, payload }, (resp?: { ok?: boolean; text?: string; error?: string }) => {
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

          // Single attempt with one retry only for connection races
          await ensureSidePanelOpen()
          try {
            const parsedText = await sendParse()
            rawContent = parsedText
            dbg(`success length=${rawContent.length}`)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            const isConnErr = msg.toLowerCase().includes('message port closed') || msg.includes('SIDE_PANEL_DISCONNECTED') || msg.includes('SIDE_PANEL_TIMEOUT')
            if (!isConnErr) throw err
            await sleep(400)
            await ensureSidePanelOpen()
            const parsedText = await sendParse()
            rawContent = parsedText
            dbg(`success (retry) length=${rawContent.length}`)
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
        } catch (e) {
          // Ignore recording failure
        }
        return JSON.stringify(toolError(`Extraction failed: ${errorMessage}`))
      }
    }
  })
}
