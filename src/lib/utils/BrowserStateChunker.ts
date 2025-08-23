import { TokenCounter } from './TokenCounter';

/**
 * Chunks browser state strings for LLM processing with token limits
 */
export class BrowserStateChunker {
  private readonly chunks: string[] = [];
  
  constructor(browserStateString: string, maxTokensPerChunk: number = 25000) {
    // Find where elements section starts
    const elementsStartIndex = this._findElementsStart(browserStateString);
    
    // Split into header (static part) and elements (dynamic part)
    const header = browserStateString.substring(0, elementsStartIndex);
    const elementsSection = browserStateString.substring(elementsStartIndex);
    
    // Check if everything fits in one chunk
    const totalTokens = TokenCounter.countString(browserStateString);
    if (totalTokens <= maxTokensPerChunk) {
      this.chunks.push(browserStateString);
      return;
    }
    
    // Calculate available tokens for elements in each chunk
    const headerTokens = TokenCounter.countString(header);
    const bufferTokens = 500; // Safety margin
    const availableForElements = maxTokensPerChunk - headerTokens - bufferTokens;
    
    // Split elements into lines
    const elementLines = elementsSection
      .split('\n')
      .filter(line => line.trim().length > 0);
    
    // Create chunks
    let currentLines: string[] = [];
    let currentTokens = 0;
    
    for (const line of elementLines) {
      const lineTokens = TokenCounter.countString(line);
      
      // Check if adding this line would exceed the limit
      if (currentTokens + lineTokens > availableForElements && currentLines.length > 0) {
        // Save current chunk
        this.chunks.push(this._buildChunk(header, currentLines, this.chunks.length));
        currentLines = [];
        currentTokens = 0;
      }
      
      currentLines.push(line);
      currentTokens += lineTokens;
    }
    
    // Add the last chunk if it has content
    if (currentLines.length > 0) {
      this.chunks.push(this._buildChunk(header, currentLines, this.chunks.length));
    }
    
    // Edge case: no chunks created
    if (this.chunks.length === 0) {
      this.chunks.push(header + '\nNo elements found');
    }
  }
  
  private _findElementsStart(stateString: string): number {
    // Common markers that indicate start of elements section
    const markers = [
      'Elements:',
      'Interactive elements',
      'Clickable:',
      'Clickable elements:',
      'Inputs:',
      'Input fields:'
    ];
    
    let earliestIndex = stateString.length;
    
    for (const marker of markers) {
      const index = stateString.indexOf(marker);
      if (index !== -1 && index < earliestIndex) {
        earliestIndex = index;
      }
    }
    
    return earliestIndex;
  }
  
  private _buildChunk(header: string, elementLines: string[], _chunkIndex: number): string {
    // Note: We don't know total chunks yet during building, will update after
    const elements = elementLines.join('\n');
    return `${header}\n${elements}`;
  }
  
  private _updateChunkHeaders(): void {
    // Update chunks with proper chunk numbers after all chunks are created
    if (this.chunks.length <= 1) return;
    
    const totalChunks = this.chunks.length;
    
    for (let i = 0; i < this.chunks.length; i++) {
      // Insert chunk marker after header
      const chunk = this.chunks[i];
      const elementsStart = this._findElementsStart(chunk);
      const header = chunk.substring(0, elementsStart);
      const elements = chunk.substring(elementsStart);
      
      this.chunks[i] = `${header}[CHUNK ${i + 1}/${totalChunks}]\n${elements}`;
    }
  }
  
  /**
   * Get a specific chunk by index
   */
  getChunk(index: number): string | null {
    // Update chunk headers on first access if needed
    if (this.chunks.length > 1 && !this.chunks[0].includes('[CHUNK')) {
      this._updateChunkHeaders();
    }
    
    if (index < 0 || index >= this.chunks.length) {
      return null;
    }
    
    return this.chunks[index];
  }
  
  /**
   * Get total number of chunks
   */
  getTotalChunks(): number {
    return this.chunks.length;
  }
}