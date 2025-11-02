/**
 * PDF-related type definitions
 *
 * Central location for all PDF processing types used across the application.
 * These types define the interfaces for PDF parsing, extraction, and processing.
 */

/**
 * Configuration options for PDF document loading and processing.
 * Used to customize PDF.js behavior and set processing limits.
 */
export interface PdfParseOptions {
  maxPages?: number;        // Maximum number of pages to process (currently hardcoded to 50 in implementation)
  disableWorker?: boolean;  // Disable PDF.js worker for corrupted PDFs (fallback mechanism)
  isEvalSupported?: boolean; // Disable eval() for security in extension context (always false)
}

/**
 * Metadata extracted from a PDF document.
 * Contains standard PDF metadata fields as defined by the PDF specification.
 */
export interface PdfMetadata {
  url: string;              // URL of the PDF document being processed
  title?: string;           // Document title from PDF metadata
  author?: string;          // Document author from PDF metadata
  subject?: string;         // Document subject from PDF metadata
  creator?: string;         // Software that created the PDF
  creationDate?: string;    // Date the PDF was originally created
  modificationDate?: string; // Date the PDF was last modified
  pageCount: number;        // Total number of pages in the document
}

/**
 * Represents a single page of extracted text content from a PDF.
 * Core data structure for text extraction results.
 */
export interface ExtractedPage {
  pageNumber: number; // Page number (1-indexed)
  text: string;       // Extracted text content from the page
}

/**
 * Result of a text search operation within a PDF.
 * Contains the page number and matching text found.
 */
export interface SearchResult {
  page: number;       // Page number where match was found (1-indexed)
  text: string;       // The text content that matched the search query
}

/**
 * Hierarchical outline/bookmark item from PDF document structure.
 * Represents entries in the document's table of contents.
 */
export interface OutlineItem {
  title: string;           // Outline entry title
  page?: number;           // Page number this outline item points to (1-indexed, optional)
  children: OutlineItem[]; // Nested outline items (empty array if no children)
}

/**
 * Information about page processing limits that were applied.
 * Used when the system caps the number of pages processed for performance.
 */
export interface PageLimitInfo {
  type: 'page_limit';           // Type identifier for limit information
  originalPagesRequested: number; // Original number of pages requested
  pagesProcessed: number;         // Actual number of pages processed
  maxPagesAllowed: number;        // Maximum pages allowed by system limits
  reason: string;                 // Human-readable reason for the limit
}

/**
 * PDF annotation data structure.
 * Placeholder for future annotation extraction functionality.
 */
// export interface Annotation {
//   // Future: Define annotation structure when implemented
//   type: string;
//   page: number;
//   content: string;
//   // Additional annotation properties as needed
// }

/**
 * Request payload for PDF parsing and extraction operations.
 * Defines what content to extract and how to process the PDF.
 */
export interface PdfParseRequest {
  url: string;        // URL of the PDF document to process
  page?: number[];    // Specific page numbers to extract [1, 3, 5] (takes precedence over pages)
  pages?: "all" | { start: number; end: number }; // Page selection: "all" or range with start/end
  format?: {          // Content extraction options
    metadata?: boolean;     // Extract document metadata
    text?: boolean;         // Extract text content from pages
    outline?: boolean;      // Extract document outline/bookmarks
    find?: {                // Search for specific text within the document
      query: string;
    };
    // annotations?: boolean;  // Extract annotations (future functionality)
    // Future: images, attachments, etc.
  };
  executionId?: string; // Unique identifier for execution-scoped caching
}

/**
 * Response payload from PDF parsing and extraction operations.
 * Contains the extracted content and processing status.
 */
export interface PdfParseResponse {
  ok: boolean;                    // Whether the operation completed successfully
  pages?: ExtractedPage[];        // Extracted page content (if text extraction requested)
  totalPages?: number;            // Total number of pages in the document
  searchResults?: SearchResult[]; // Search results (if search was performed)
  outline?: OutlineItem[];        // Document outline/bookmarks (if outline extraction requested)
  // annotations?: Annotation[];     // Annotations data (future functionality)
  metadata?: PdfMetadata;         // Document metadata (if metadata extraction requested)
  limitApplied?: PageLimitInfo;   // Information about applied limits (e.g., page count restrictions)
  error?: string; // Error message if operation failed
}