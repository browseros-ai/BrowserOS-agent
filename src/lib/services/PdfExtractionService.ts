import { PDFDocumentProxy } from 'pdfjs-dist' // PDF.js PDFDocumentProxy: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html
import { ExtractedPage, SearchResult, OutlineItem } from '../types/pdf'

/**
 * PdfExtractionService - Handles PDF text extraction, search, and outline
 *
 * This service provides specialized extraction methods for PDF content:
 * - Text extraction from pages (converts PDF text content to readable strings)
 * - Text search functionality within PDF pages (finds matches across pages)
 * - Document outline/bookmarks extraction (table of contents)
 *
 * All operations work with PDF.js page proxies and handle errors gracefully.
 */
export class PdfExtractionService {
  constructor() {}

  /**
   * Extract text content from specified PDF pages
   * @param doc - Loaded PDF document proxy
   * @param pageNumbers - Array of page numbers to extract (1-indexed)
   * @returns Array of extracted pages with text content
   *
   * This method iterates through each requested page, gets the text content
   * from PDF.js, and converts it to readable text strings. It handles
   * individual page failures gracefully by continuing with other pages.
   */
  async extractText(doc: PDFDocumentProxy, pageNumbers: number[]): Promise<ExtractedPage[]> {
    const extractedPages: ExtractedPage[] = []

    // Process each page individually to handle failures gracefully
    for (const pageNum of pageNumbers) {
      try {
        // Step 1: Get the page proxy from PDF.js
        const page = await doc.getPage(pageNum) // PDF.js getPage: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html#getPage

        // Step 2: Extract text content from the page
        // This returns text items with positioning information
        const content = await page.getTextContent() // PDF.js getTextContent: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html#getTextContent

        // Step 3: Convert PDF.js text items to readable text
        const textItems: string[] = []
        for (const item of content.items) {
          const textItem: any = item
          // Only include items that have actual text content
          if (typeof textItem.str === 'string') {
            textItems.push(textItem.str)
          }
        }

        // Step 4: Store the extracted page data
        extractedPages.push({
          pageNumber: pageNum,
          text: textItems.join(' ') // Join text items with spaces
        })
      } catch (error) {
        console.warn(`Failed to extract text from page ${pageNum}:`, error)
        // Continue with other pages rather than failing completely
        // Add an error placeholder for the failed page
        extractedPages.push({
          pageNumber: pageNum,
          text: `[Error extracting text from page ${pageNum}]`
        })
      }
    }

    return extractedPages
  }

  /**
   * Search for text within PDF pages using PDF.js text content items
   * @param doc - Loaded PDF document proxy
   * @param query - Search query (case-insensitive substring matching)
   * @param pageNumbers - Pages to search in (1-indexed)
   * @returns Array of search results with page and text information
   *
   * This method searches for text matches across multiple pages.
   * It uses PDF.js text content extraction and performs case-insensitive
   * substring matching. Results include the page number and matching text.
   */
  async searchText(doc: PDFDocumentProxy, query: string, pageNumbers: number[]): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    // Normalize search query for consistent matching
    const searchQuery = query.toLowerCase().trim()

    // Skip search if query is empty
    if (!searchQuery) {
      return results // Return empty results for empty query
    }

    // Search through each requested page
    for (const pageNum of pageNumbers) {
      try {
        // Step 1: Get page proxy
        const page = await doc.getPage(pageNum) // PDF.js getPage: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html#getPage

        // Step 2: Get text content from the page
        const textContent = await page.getTextContent() // PDF.js getTextContent: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html#getTextContent

        // Step 3: Filter text items that contain the search query
        // PDF.js text content comes as an array of text items with positioning
        const matches = textContent.items.filter((item: any) => {
          // Check if this text item contains our search query
          if (typeof item.str === 'string') {
            return item.str.toLowerCase().includes(searchQuery)
          }
          return false
        })

        // Step 4: Convert matches to our result format
        // Include page number and the matching text
        matches.forEach((match: any) => {
          results.push({
            page: pageNum,
            text: match.str // The actual text that matched
          })
        })

      } catch (error) {
        console.warn(`Failed to search text on page ${pageNum}:`, error)
        // Continue with other pages rather than failing completely
      }
    }

    return results
  }

  /**
   * Extract document outline/bookmarks (table of contents)
   * @param doc - Loaded PDF document proxy
   * @returns Hierarchical outline structure with titles and page destinations
   *
   */
  async extractOutline(doc: PDFDocumentProxy): Promise<OutlineItem[]> {
    try {
      // Get outline from PDF.js - this is the document's table of contents
      const outline = await doc.getOutline() // PDF.js getOutline: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html#getOutline

      // Check if document has an outline
      if (!outline || outline.length === 0) {
        return [] // No outline available - return empty array
      }

      // Convert PDF.js outline format to our structured format
      // PDF.js outline is hierarchical, so we need to process it recursively
      const convertOutlineItem = (item: any): OutlineItem => {
        // Extract page number from destination reference
        let pageNumber = null
        if (item.dest) {
          // PDF destination format can be complex: [pageRef, view, x, y, zoom]
          if (Array.isArray(item.dest) && item.dest.length > 0) {
            const pageRef = item.dest[0]
            // Handle different page reference formats
            if (typeof pageRef === 'number') {
              pageNumber = pageRef
            } else if (pageRef && typeof pageRef === 'object' && pageRef.num) {
              // Some PDFs use object references with .num property
              pageNumber = pageRef.num
            }
          }
        }

        // Create our standardized outline item
        const outlineItem: OutlineItem = {
          title: item.title || '', // Outline entry title
          page: pageNumber || undefined, // Page number (1-indexed) or undefined
          children: [] // Nested outline items
        }

        // Recursively process children if they exist
        if (item.items && Array.isArray(item.items)) {
          outlineItem.children = item.items.map(convertOutlineItem)
        }

        return outlineItem
      }

      // Convert the entire outline structure
      return outline.map(convertOutlineItem)
    } catch (error) {
      console.warn('Failed to extract PDF outline:', error)
      return [] // Return empty array on error rather than failing
    }
  }
}