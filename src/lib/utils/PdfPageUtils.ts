/**
 * PDF Page Utilities
 *
 * Utility functions for parsing and handling PDF page parameters
 */

/**
 * Parse page parameters into an array of page numbers
 * @param pageParam - Specific page numbers array [1, 3, 5]
 * @param pagesParam - Page specification ("all" or {start: 1, end: 10})
 * @param totalPages - Total number of pages in the document
 * @returns Array of page numbers to process
 */
export function parsePagesParam(
  pageParam: number[] | undefined,
  pagesParam: "all" | { start: number; end: number } | undefined,
  totalPages: number
): number[] {
  // Specific page numbers take precedence
  if (pageParam && pageParam.length > 0) {
    return pageParam.filter(p => p >= 1 && p <= totalPages);
  }

  // Handle "all" pages
  if (pagesParam === "all") {
    return Array.from({length: totalPages}, (_, i) => i + 1);
  }

  // Handle range objects {start: 1, end: 10}
  if (typeof pagesParam === 'object' && pagesParam.start && pagesParam.end) {
    const start = Math.max(1, pagesParam.start);
    const end = Math.min(totalPages, pagesParam.end);
    return Array.from({length: end - start + 1}, (_, i) => start + i);
  }

  // Default to all pages
  return Array.from({length: totalPages}, (_, i) => i + 1);
}