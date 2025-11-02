import { MessageType } from '../types/messaging'
import { PdfProcessingService } from './PdfProcessingService'
import { PdfParseRequest, PdfParseResponse } from '../types/pdf'
import { PDFDocumentProxy } from 'pdfjs-dist'
import { Logging } from '../utils/Logging'

/**
 * PdfRequestHandler - Handles PDF parsing message routing and response formatting
 *
 * This service acts as the interface between the Chrome message system
 * and the PDF processing services. It:
 * - Receives PDF_PARSE_REQUEST messages from the browser extension
 * - Calls the processing service to handle the actual PDF operations
 * - Formats and sends PDF_PARSE_RESPONSE messages back to the sender
 * - Centralizes error handling and logging
 * - Caches PDF proxies per execution for performance optimization
 *
 * The caching is important because PDF loading is expensive, and multiple
 * operations on the same PDF (metadata + text extraction) should reuse
 * the same loaded document.
 */
export class PdfRequestHandler {
  // Cache structure: executionId -> Map<url, PDFDocumentProxy>
  // This allows multiple PDFs per execution but limits cache size per execution
  private cache: Map<string, Map<string, PDFDocumentProxy>> = new Map()
  private readonly MAX_CACHED_PDFS_PER_EXECUTION = 3

  constructor(private processingService: PdfProcessingService) {}

  /**
   * Handle an incoming PDF parse request message
   * @param message - The incoming Chrome message with requestId and payload
   *
   * This method processes PDF requests from the browser extension.
   * It handles caching, delegates to the processing service, and
   * sends responses back through Chrome's messaging system.
   */
  async handleRequest(message: any): Promise<void> {
    const { requestId, payload } = message

    console.log('[PdfRequestHandler] Handling request:', requestId, 'payload:', payload)
    console.log('[PdfRequestHandler] Current cache state:', this.cache.size, 'executions,', Array.from(this.cache.values()).reduce((sum, execCache) => sum + execCache.size, 0), 'total PDFs cached')

    try {
      // Step 1: Validate request has required URL
      if (!payload || !payload.url) {
        console.log('[PdfRequestHandler] PDF parsing failed: MISSING_URL')
        this.sendResponse(requestId, {
          ok: false,
          error: 'MISSING_URL'
        })
        return
      }

      // Step 2: Create standardized request object from payload
      const request: PdfParseRequest = {
        url: payload.url,
        page: payload.page,
        pages: payload.pages,
        format: payload.format,
        executionId: payload.executionId // Used for caching
      }

      // Step 3: Check cache for existing PDF document
      let cachedDoc: PDFDocumentProxy | undefined
      if (request.executionId) {
        // Get the cache for this execution
        const executionCache = this.cache.get(request.executionId)
        if (executionCache) {
          // Check if this specific URL is cached
          cachedDoc = executionCache.get(request.url)
          if (cachedDoc) {
            console.log('[PdfRequestHandler] Using cached PDF for execution:', request.executionId, 'URL:', request.url, '(cache size:', executionCache.size, 'PDFs)')
          } else {
            console.log('[PdfRequestHandler] Cache miss for execution:', request.executionId, 'URL:', request.url, '(cache has:', executionCache.size, 'PDFs)')
          }
        } else {
          console.log('[PdfRequestHandler] No cache found for execution:', request.executionId)
        }
      }

      // Step 4: Process the request (load PDF if needed, extract data)
      console.log('[PdfRequestHandler] Starting PDF parsing for URL:', request.url, 'pages param:', request.pages, 'cached:', !!cachedDoc)
      const result = await this.processingService.processRequest(request, cachedDoc)
      const { loadedDoc, ...response } = result

      // Step 5: Cache the newly loaded document if applicable
      if (request.executionId && loadedDoc) {
        // Get or create cache for this execution
        let executionCache = this.cache.get(request.executionId)
        if (!executionCache) {
          executionCache = new Map()
          this.cache.set(request.executionId, executionCache)
        }

        // Check cache size limit before adding
        const previousSize = executionCache.size
        if (executionCache.size >= this.MAX_CACHED_PDFS_PER_EXECUTION) {
          // Remove oldest cached PDF (simple FIFO eviction)
          const keyToRemove = executionCache.keys().next().value!
          console.log('[PdfRequestHandler] Evicting cached PDF due to limit:', keyToRemove)
          executionCache.delete(keyToRemove)
        }

        // Cache the new document
        executionCache.set(request.url, loadedDoc)
        console.log('[PdfRequestHandler] Cached PDF for execution:', request.executionId, 'URL:', request.url, '(cache size:', previousSize, '→', executionCache.size, 'PDFs)')
      }

      console.log('[PdfRequestHandler] Processing service returned:', response)

      // Step 6: Send appropriate response based on success/failure
      if (response.ok) {
        console.log('[PdfRequestHandler] PDF parsing completed successfully, pages extracted:', response.pages?.length)
      } else {
        console.log('[PdfRequestHandler] PDF parsing failed:', response.error)
      }

      // Send response back to the requesting component
      this.sendResponse(requestId, response)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[PdfRequestHandler] Unexpected error:', errorMessage)

      this.sendResponse(requestId, {
        ok: false,
        error: errorMessage
      })
    }
  }

  /**
   * Send a response message back to the sender
   * @param requestId - The request ID to match responses
   * @param response - The response payload
   */
  private sendResponse(requestId: string, response: PdfParseResponse): void {
    chrome.runtime.sendMessage({
      type: MessageType.PDF_PARSE_RESPONSE,
      requestId,
      ...response
    })
  }

  /**
   * Clear cache for a specific execution
   * @param executionId - The execution ID to clear cache for
   */
  clearCache(executionId: string): void {
    const executionCache = this.cache.get(executionId)
    const pdfCount = executionCache ? executionCache.size : 0
    this.cache.delete(executionId)
    Logging.log('PdfRequestHandler', `Cleared cache for execution: ${executionId} (${pdfCount} PDFs removed), total executions cached: ${this.cache.size}`)
  }
}