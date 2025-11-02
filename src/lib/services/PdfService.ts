import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist' // PDF.js APIs: https://mozilla.github.io/pdf.js/api/draft/
import { PdfParseOptions, PdfMetadata } from '../types/pdf'

/**
 * PdfService - Core PDF operations using PDF.js v5.4.296
 *
 * This service encapsulates PDF.js functionality for:
 * - Document loading and parsing
 * - Metadata extraction
 */
export class PdfService {
  constructor() {
    // Configure PDF.js worker for extension environment
    // PDF.js v5.4.296 requires worker to be configured globally, even if disabled per document
    // This is for PDF.js to function in Chrome extensions
    try {
      GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs') // PDF.js GlobalWorkerOptions.workerSrc: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-GlobalWorkerOptions.html#workerSrc
    } catch (error) {
      // If chrome.runtime is not available, log warning but continue
      // This can happen during testing or when the extension context is not ready
      console.warn('Chrome runtime not available for PDF.js worker setup')
    }
  }

  /**
   * Load PDF document from URL or Uint8Array
   * @param source - URL string or Uint8Array of PDF bytes
   * @param options - PDF loading options
   * @returns PDFDocumentProxy - A proxy object that provides access to PDF document methods
   *
   * This method handles the initial PDF loading and parsing.
   */
  async loadDocument(
    source: string | Uint8Array,
    options: PdfParseOptions = {}
  ): Promise<PDFDocumentProxy> {
    // Configure PDF.js for extension environment
    // Worker is required for PDF.js v5.4.296 to function
    // We disable various features to optimize for extension environment
    const pdfOptions = {
      url: typeof source === 'string' ? source : undefined,
      data: source instanceof Uint8Array ? source : undefined,
      isEvalSupported: false, // Disable eval for security in extension context
      // Worker required for PDF.js functionality - handles parsing in background thread
      disableFontFace: true, // Disable font loading for performance
      disableRange: true, // Disable range requests
      disableStream: true, // Disable streaming for simpler loading
      disableAutoFetch: true, // Disable automatic resource fetching
      // Provide standard font data URL to prevent warnings about missing fonts
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/standard_fonts/',
      ...options // Allow overriding defaults
    }

    try {
      // Step 1: Get the loading task from PDF.js
      const loadingTask = getDocument(pdfOptions) // PDF.js getDocument: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html#.getDocument

      // Step 2: Await the promise to get the actual PDF document proxy
      // This is where the heavy PDF parsing happens (in the worker thread)
      return await loadingTask.promise // PDF.js PDFDocumentLoadingTask.promise: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentLoadingTask.html#promise
    } catch (error) {
      console.error('PDF.js loading failed:', error)
      throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Get PDF metadata
   * @param doc - Loaded PDF document proxy from loadDocument()
   * @param url - Original PDF URL for reference
   * @returns PDF metadata object with document information
   *
   * Extracts standard PDF metadata fields like title, author, creation date, etc.
   * This is a lightweight operation that doesn't require page content parsing.
   */
  async getMetadata(doc: PDFDocumentProxy, url: string): Promise<PdfMetadata> {
    // Get metadata from PDF.js - this is a fast operation that reads document info
    const info = await doc.getMetadata() // PDF.js getMetadata: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html#getMetadata

    // Extract standard PDF metadata fields
    // PDF metadata is stored in the 'info' object with specific field names
    return {
      url, // Keep track of source URL
      title: (info.info as any)?.Title || undefined, // Document title
      author: (info.info as any)?.Author || undefined, // Document author
      subject: (info.info as any)?.Subject || undefined, // Document subject
      creator: (info.info as any)?.Creator || undefined, // Software that created the PDF
      creationDate: (info.info as any)?.CreationDate || undefined, // When PDF was created
      modificationDate: (info.info as any)?.ModDate || undefined, // When PDF was last modified
      pageCount: doc.numPages // PDF.js numPages: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html#numPages
    }
  }
}