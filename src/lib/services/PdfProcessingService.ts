import { PDFDocumentProxy } from 'pdfjs-dist' // PDF.js PDFDocumentProxy: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html
import { PdfService } from './PdfService'
import { PdfExtractionService } from './PdfExtractionService'
import { parsePagesParam } from '../utils/PdfPageUtils'
import { PdfParseRequest, PdfParseResponse } from '../types/pdf'

/**
 * PdfProcessingService - Orchestrates PDF processing operations
 *
 * This service coordinates the PDF processing workflow:
 * 1. Load PDF document from URL
 * 2. Parse page parameters
 * 3. Extract requested content types
 * 4. Return structured results
 *
 * It acts as the main business logic layer between the message handler
 * and the specialized extraction services.
 */
export class PdfProcessingService {
  constructor(
    private pdfService: PdfService,
    private extractionService: PdfExtractionService
  ) {}

  /**
   * Process a PDF parsing request
   * @param request - PDF parsing request with URL and page parameters
   * @param cachedDoc - Optional cached PDF document proxy
   * @returns PDF parsing response with extracted content and loaded document if newly loaded
   *
   * This is the main orchestration method that:
   * 1. Loads or reuses cached PDF document
   * 2. Applies page limits for performance
   * 3. Routes to appropriate extraction services based on request.format
   * 4. Returns structured response with all requested data
   */
  async processRequest(request: PdfParseRequest, cachedDoc?: PDFDocumentProxy): Promise<PdfParseResponse & { loadedDoc?: PDFDocumentProxy }> {
    try {
      // Step 1: Validate request has required URL
      if (!request.url || typeof request.url !== 'string') {
        const errorResponse = {
          ok: false,
          error: 'MISSING_URL'
        }
        console.log('[PdfProcessingService] Returning error response:', errorResponse)
        return errorResponse
      }

      // Step 2: Load PDF document or use cached version
      let doc: PDFDocumentProxy
      let newlyLoaded = false
      if (cachedDoc) {
        // Reuse cached document to avoid re-loading
        doc = cachedDoc
        console.log('[PdfProcessingService] Using cached PDF document')
      } else {
        // Load fresh document from URL
        newlyLoaded = true
        try {
          doc = await this.pdfService.loadDocument(request.url)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)

          // Handle specific PDF structure errors with retry
          // Some PDFs have corrupted structures but can be loaded with different options
          if (errorMessage.includes('Invalid PDF structure')) {
            try {
              // Retry with different options for corrupted PDFs
              doc = await this.pdfService.loadDocument(request.url, {
                disableWorker: true // Try without worker for corrupted PDFs
              })
            } catch (retryError) {
              const errorResponse = {
                ok: false,
                error: 'PARSE_INVALID_STRUCTURE'
              }
              console.log('[PdfProcessingService] Returning error response:', errorResponse)
              return errorResponse
            }
          } else {
            const errorResponse = {
              ok: false,
              error: errorMessage
            }
            console.log('[PdfProcessingService] Returning error response:', errorResponse)
            return errorResponse
          }
        }
      }

      // Step 3: Initialize response with basic document info
      const response: PdfParseResponse = {
        ok: true,
        totalPages: doc.numPages || 0 // PDF.js numPages: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html#numPages
      }

      // Step 4: Extract metadata if requested (fast operation)
      if (request.format?.metadata) {
        try {
          const metadata = await this.pdfService.getMetadata(doc, request.url)
          response.metadata = metadata
        } catch (error) {
          console.warn('[PdfProcessingService] Failed to extract metadata:', error)
          // Don't fail the entire request if metadata extraction fails
        }
      }

      // Step 5: Extract text content (for backwards compatibility, text format, or AI processing)
      // Text extraction is a common operation that includes page limit enforcement for performance
      if (!request.format || request.format.text || (!request.format.metadata && !request.format.find)) {
        // Parse page parameters to determine which pages to extract
        const pagesToExtract = parsePagesParam(
          request.page,
          request.pages,
          doc.numPages || 0
        )

        // Apply 50-page limit to text extraction operations
        // This prevents resource exhaustion on large PDFs when extracting page content
        let cappedPages = pagesToExtract;
        let limitApplied = false;

        if (pagesToExtract.length > 50) {
          cappedPages = pagesToExtract.slice(0, 50); // Take first 50 pages only
          limitApplied = true;
          console.log(`[PdfProcessingService] Applied 50-page limit: ${pagesToExtract.length} → ${cappedPages.length} pages`);
        }

        // Extract text from the selected pages
        const extractedPages = await this.extractionService.extractText(doc, cappedPages)

        // Add limit metadata to response if we had to cap pages
        if (limitApplied) {
          response.limitApplied = {
            type: 'page_limit',
            originalPagesRequested: pagesToExtract.length,
            pagesProcessed: cappedPages.length,
            maxPagesAllowed: 50,
            reason: 'PDF processing limited to first 50 requested pages to prevent resource exhaustion'
          };
        }

        response.pages = extractedPages
      }

      // Step 6: Extract search results if requested
      if (request.format?.find) {
        // Parse page parameters for search scope
        const pagesToSearch = parsePagesParam(
          request.page,
          request.pages,
          doc.numPages || 0
        )

        // Apply 50-page limit to search operations (same as text extraction)
        let cappedSearchPages = pagesToSearch;
        let searchLimitApplied = false;

        if (pagesToSearch.length > 50) {
          cappedSearchPages = pagesToSearch.slice(0, 50);
          searchLimitApplied = true;
          console.log(`[PdfProcessingService] Applied 50-page limit to search: ${pagesToSearch.length} → ${cappedSearchPages.length} pages`);
        }

        // Perform text search across selected pages
        const searchResults = await this.extractionService.searchText(doc, request.format.find.query, cappedSearchPages)

        // Add limit metadata to response if not already present
        if (searchLimitApplied && !response.limitApplied) {
          response.limitApplied = {
            type: 'page_limit',
            originalPagesRequested: pagesToSearch.length,
            pagesProcessed: cappedSearchPages.length,
            maxPagesAllowed: 50,
            reason: 'PDF processing limited to first 50 requested pages to prevent resource exhaustion'
          };
        }

        response.searchResults = searchResults
      }

      // Step 7: Extract outline if requested
      if (request.format?.outline) {
        try {
          const outline = await this.extractionService.extractOutline(doc)
          response.outline = outline
        } catch (error) {
          console.warn('[PdfProcessingService] Failed to extract outline:', error)
          // Don't fail the entire request if outline extraction fails
          response.outline = []
        }
      }

      console.log('[PdfProcessingService] Returning response:', response)
      // Return both the response and the loaded document (if newly loaded for caching)
      return { ...response, loadedDoc: newlyLoaded ? doc : undefined }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[PdfProcessingService] Processing failed:', errorMessage)

      const errorResponse = {
        ok: false,
        error: errorMessage
      }
      console.log('[PdfProcessingService] Returning error response:', errorResponse)
      return errorResponse
    }
  }
}