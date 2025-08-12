import { z } from 'zod';
// pdf.js ESM
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
// import { type BrowserContextConfig } from './BrowserContext';
import { Logging } from '../utils/Logging';
import { getBrowserOSAdapter, type InteractiveNode, type InteractiveSnapshot, type Snapshot, type SnapshotOptions } from './BrowserOSAdapter';
import { profileAsync } from '../utils/Profiler';

// Attributes to include in the compact format
// Comment out any attributes you want to exclude
const INCLUDED_ATTRIBUTES = [
  'type',           // Input type (text, email, password, etc.)
  'placeholder',    // Placeholder text for inputs
  'value',          // Current value of inputs
  'href',           // Link URLs
  'aria-label',     // Accessibility label
  // 'role',        // ARIA role (commented out - already in tag)
  // 'autocomplete', // Autocomplete hint
  // 'checked-state', // Checkbox/radio state
  // 'input-type',   // Duplicate of 'type'
] as const;

// Schema for interactive elements
export const InteractiveElementSchema = z.object({
  nodeId: z.number(),  // Chrome BrowserOS node ID (sequential index)
  text: z.string(),  // Element text (axName or tag)
  tag: z.string()  // HTML tag name
});

export type InteractiveElement = z.infer<typeof InteractiveElementSchema>;

// Helper functions for compact format
function getTypeSymbol(type: string): string {
  switch (type) {
    case 'clickable':
    case 'selectable':  // Treat selectable as clickable
      return 'C';
    case 'typeable':
      return 'T';
    default:
      return 'O';
  }
}

function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function formatAttributes(node: InteractiveNode): string {
  if (!node.attributes) return '';
  
  const attrs: string[] = [];
  
  for (const attrKey of INCLUDED_ATTRIBUTES) {
    const value = node.attributes[attrKey];
    if (value) {
      attrs.push(`${attrKey}=${value}`);
    }
  }
  
  return attrs.length > 0 ? `attr:"${attrs.join(' ')}"` : '';
}

function formatPath(path: string | undefined): string {
  if (!path) return '';
  
  // Extract last 3 meaningful parts of the path
  const parts = path.split(' > ').filter(p => p && p !== 'root');
  const lastParts = parts.slice(-3);
  
  return lastParts.length > 0 ? `path:"${lastParts.join('>')}"` : '';
}

/**
 * BrowserPage - Simple browser page wrapper using Chrome BrowserOS APIs
 * 
 * This class provides:
 * 1. Direct element access via index-based APIs
 * 2. Element formatting for tools
 * 3. Simple action methods using BrowserOSAdapter
 */
export class BrowserPage {
  private _tabId: number;
  private _url: string;
  private _title: string;
  private _browserOS = getBrowserOSAdapter();
  
  // Cache for the latest interactive snapshot
  private _cachedSnapshot: InteractiveSnapshot | null = null;
  // Map from nodeId to interactive node
  private _nodeIdToNodeMap: Map<number, InteractiveNode> = new Map();
  // Cache timestamp for expiry
  private _cacheTimestamp: number = 0;
  // Cache expiry duration in milliseconds (5 seconds)
  private readonly _cacheExpiryMs = 5000;

  constructor(tabId: number, url: string, title: string) {
    this._tabId = tabId;
    this._url = url;
    this._title = title;
    
    Logging.log('BrowserPage', `Page created for tab ${this._tabId}`);
  }

  get tabId(): number {
    return this._tabId;
  }

  url(): string {
    return this._url;
  }

  async title(): Promise<string> {
    // Get latest title from Chrome API
    try {
      const tab = await chrome.tabs.get(this._tabId);
      this._title = tab.title || '';
      return this._title;
    } catch {
      return this._title;
    }
  }

  // ============= Core BrowserOS Integration =============

  /**
   * Invalidate the cached snapshot
   */
  private _invalidateCache(): void {
    this._cachedSnapshot = null;
    this._cacheTimestamp = 0;
    this._nodeIdToNodeMap.clear();
    Logging.log('BrowserPage', `Cache invalidated for tab ${this._tabId}`, 'info');
  }

  /**
   * Check if the cached snapshot is still valid
   */
  private _isCacheValid(): boolean {
    return this._cachedSnapshot !== null && 
           this._cacheTimestamp > 0 &&
           (Date.now() - this._cacheTimestamp) < this._cacheExpiryMs;
  }

  /**
   * Get interactive snapshot and update cache
   */
  private async _getSnapshot(): Promise<InteractiveSnapshot | null> {
    return profileAsync('BrowserPage._getSnapshot', async () => {
    // Return cached snapshot if still valid
    if (this._isCacheValid()) {
      Logging.log('BrowserPage', `Using cached snapshot for tab ${this._tabId}`, 'info');
      return this._cachedSnapshot;
    }

    try {
      Logging.log('BrowserPage', `Fetching fresh snapshot for tab ${this._tabId}`, 'info');
      const snapshot = await this._browserOS.getInteractiveSnapshot(this._tabId);
      this._cachedSnapshot = snapshot;
      this._cacheTimestamp = Date.now();
      
      // Rebuild nodeId map for interactive elements only
      this._nodeIdToNodeMap.clear();
      for (const node of snapshot.elements) {
        if (node.type === 'clickable' || node.type === 'typeable' || node.type === 'selectable') {
          this._nodeIdToNodeMap.set(node.nodeId, node);
        }
      }
      
      return snapshot;
    } catch (error) {
      Logging.log('BrowserPage', `Failed to get snapshot: ${error}`, 'error');
      this._invalidateCache();
      return null;
    }
    });
  }

  /**
   * Get all interactive elements as a formatted string
   * This is what tools should use instead of parsing DOM
   */
  async getElementsAsString(): Promise<string> {
    return profileAsync('BrowserPage.getElementsAsString', async () => {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return 'No interactive elements found';
    }

    const lines: string[] = [];
    
    for (const node of snapshot.elements) {
      if (node.type === 'other') continue;  // Skip non-interactive

      const parts: string[] = [];
      
      // Add indentation based on depth
      const depth = parseInt(node.attributes?.depth || '0', 10);
      const indent = '  '.repeat(depth);  // 2 spaces per level
      
      // [nodeId]
      parts.push(`${indent}[${node.nodeId}]`);
      
      // <T> - Type symbol
      parts.push(`<${getTypeSymbol(node.type)}>`);
      
      // <tag> - HTML tag or role
      const tag = node.attributes?.['html-tag'] || node.attributes?.role || 'div';
      parts.push(`<${tag}>`);
      
      // "name" - Truncated to 40 chars
      if (node.name) {
        parts.push(`"${truncateText(node.name, 40)}"`);
      }
      
      // ctx:"context" - Truncated to 60 chars
      if (node.attributes?.context) {
        parts.push(`ctx:"${truncateText(node.attributes.context, 60)}"`);
      }
      
      // path:"...>..." - Last 3 parts
      if (node.attributes?.path) {
        parts.push(formatPath(node.attributes.path));
      }
      
      // attr:"key=value ..." - Only included attributes
      const attrString = formatAttributes(node);
      if (attrString) {
        parts.push(attrString);
      }
      
      lines.push(parts.join(' '));
    }
    
    return lines.join('\n');
    });
  }

  /**
   * Get clickable elements as a formatted string
   */
  async getClickableElementsString(simplified: boolean = false): Promise<string> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return '';
    }

    const lines: string[] = [];
    
    if (simplified) {
      // SIMPLIFIED MODE: Only [nodeId] name
      for (const node of snapshot.elements) {
        if (node.type === 'clickable' || node.type === 'selectable') {
          // Skip if no name or empty name
          if (!node.name || node.name.trim() === '') continue;
          
          // Simple format: [nodeId] name
          lines.push(`[${node.nodeId}] ${node.name}`);
        }
      }
    } else {
      // FULL MODE: Current implementation
      for (const node of snapshot.elements) {
        if (node.type === 'clickable' || node.type === 'selectable') {
          const parts: string[] = [];
          
          // Add indentation based on depth
          const depth = parseInt(node.attributes?.depth || '0', 10);
          const indent = '  '.repeat(depth);  // 2 spaces per level
          
          // [nodeId]
          parts.push(`${indent}[${node.nodeId}]`);
          
          // <C> - Clickable type
          parts.push('<C>');
          
          // <tag>
          const tag = node.attributes?.['html-tag'] || node.attributes?.role || 'div';
          parts.push(`<${tag}>`);
          
          // "name"
          if (node.name) {
            parts.push(`"${truncateText(node.name, 40)}"`);
          }
          
          // ctx:"context"
          if (node.attributes?.context) {
            parts.push(`ctx:"${truncateText(node.attributes.context, 60)}"`);
          }
          
          // path:"...>..."
          if (node.attributes?.path) {
            parts.push(formatPath(node.attributes.path));
          }
          
          // attr:"key=value ..."
          const attrString = formatAttributes(node);
          if (attrString) {
            parts.push(attrString);
          }
          
          lines.push(parts.join(' '));
        }
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Get typeable elements as a formatted string
   */
  async getTypeableElementsString(simplified: boolean = false): Promise<string> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return '';
    }

    const lines: string[] = [];
    
    if (simplified) {
      // SIMPLIFIED MODE: Only [nodeId] name/placeholder/type
      for (const node of snapshot.elements) {
        if (node.type === 'typeable') {
          // Use name, or placeholder, or type as fallback
          const displayName = node.name || 
                            node.attributes?.placeholder || 
                            node.attributes?.type ||
                            'input';
          
          lines.push(`[${node.nodeId}] ${displayName}`);
        }
      }
    } else {
      // FULL MODE: Current implementation
      for (const node of snapshot.elements) {
        if (node.type === 'typeable') {
          const parts: string[] = [];
          
          // Add indentation based on depth
          const depth = parseInt(node.attributes?.depth || '0', 10);
          const indent = '  '.repeat(depth);  // 2 spaces per level
          
          // [nodeId]
          parts.push(`${indent}[${node.nodeId}]`);
          
          // <T> - Typeable type
          parts.push('<T>');
          
          // <tag>
          const tag = node.attributes?.['html-tag'] || node.attributes?.role || 'input';
          parts.push(`<${tag}>`);
          
          // "name" - Often empty for inputs, so include placeholder
          const displayName = node.name || node.attributes?.placeholder || '';
          if (displayName) {
            parts.push(`"${truncateText(displayName, 40)}"`);
          }
          
          // ctx:"context"
          if (node.attributes?.context) {
            parts.push(`ctx:"${truncateText(node.attributes.context, 60)}"`);
          }
          
          // path:"...>..."
          if (node.attributes?.path) {
            parts.push(formatPath(node.attributes.path));
          }
          
          // attr:"key=value ..." - Includes type, placeholder, value
          const attrString = formatAttributes(node);
          if (attrString) {
            parts.push(attrString);
          }
          
          lines.push(parts.join(' '));
        }
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Get clickable elements with nodeId, text, and tag
   */
  async getClickableElements(): Promise<InteractiveElement[]> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return [];
    }

    const clickableElements: InteractiveElement[] = [];
    
    for (const node of snapshot.elements) {
      if (node.type === 'clickable' || node.type === 'selectable') {
        clickableElements.push({
          nodeId: node.nodeId,
          text: node.name || '',
          tag: node.attributes?.['html-tag'] || node.attributes?.role || ''
        });
      }
    }
    
    return clickableElements;
  }

  /**
   * Get typeable elements with nodeId, text, and tag
   */
  async getTypeableElements(): Promise<InteractiveElement[]> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return [];
    }

    const typeableElements: InteractiveElement[] = [];
    
    for (const node of snapshot.elements) {
      if (node.type === 'typeable') {
        typeableElements.push({
          nodeId: node.nodeId,
          text: node.name || '',
          tag: node.attributes?.['html-tag'] || node.attributes?.role || ''
        });
      }
    }
    
    return typeableElements;
  }

  /**
   * Get element by nodeId
   */
  async getElementByIndex(nodeId: number): Promise<InteractiveNode | null> {
    if (!this._cachedSnapshot) {
      await this._getSnapshot();
    }
    return this._nodeIdToNodeMap.get(nodeId) || null;
  }

  /**
   * Get all interactive elements
   */
  async getInteractiveElements(): Promise<Map<number, InteractiveNode>> {
    await this._getSnapshot();
    return new Map(this._nodeIdToNodeMap);
  }

  /**
   * Get hierarchical structure from the latest snapshot
   */
  async getHierarchicalStructure(): Promise<string | null> {
    const snapshot = await this._getSnapshot();
    return snapshot?.hierarchicalStructure || null;
  }

  // ============= Actions =============

  /**
   * Click element by node ID
   */
  async clickElement(nodeId: number): Promise<void> {
    await profileAsync(`BrowserPage.clickElement[${nodeId}]`, async () => {
    await this._browserOS.click(this._tabId, nodeId);
    this._invalidateCache();  // Invalidate cache after click
    await this.waitForStability();
    });
  }

  /**
   * Input text by node ID
   */
  async inputText(nodeId: number, text: string): Promise<void> {
    await profileAsync(`BrowserPage.inputText[${nodeId}]`, async () => {
    await this._browserOS.clear(this._tabId, nodeId);
    await this._browserOS.inputText(this._tabId, nodeId, text);
    this._invalidateCache();  // Invalidate cache after text input
    await this.waitForStability();
    });
  }

  /**
   * Clear element by node ID
   */
  async clearElement(nodeId: number): Promise<void> {
    await this._browserOS.clear(this._tabId, nodeId);
    this._invalidateCache();  // Invalidate cache after clearing
    await this.waitForStability();
  }

  /**
   * Scroll to element by node ID
   */
  async scrollToElement(nodeId: number): Promise<boolean> {
    return await this._browserOS.scrollToNode(this._tabId, nodeId);
  }


  /**
   * Send keyboard keys
   */
  async sendKeys(keys: string): Promise<void> {
    // Define supported keys based on chrome.browserOS.Key type
    const supportedKeys = [
      'Enter', 'Delete', 'Backspace', 'Tab', 'Escape',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Home', 'End', 'PageUp', 'PageDown'
    ];
    
    if (!supportedKeys.includes(keys)) {
      throw new Error(`Unsupported key: "${keys}". Supported keys are: ${supportedKeys.join(', ')}`);
    }
    
    await this._browserOS.sendKeys(this._tabId, keys as chrome.browserOS.Key);
    
    // Only invalidate cache for keys that might change the DOM structure
    const domChangingKeys = ['Enter', 'Delete', 'Backspace', 'Tab'];
    if (domChangingKeys.includes(keys)) {
      this._invalidateCache();
    }
    
    await this.waitForStability();
  }

  /**
   * Scroll page up/down
   */
  async scrollDown(amount?: number): Promise<void> {
    // If amount not specified, default to 1 viewport
    const scrollCount = amount || 1;
    
    // Scroll the specified number of viewports with delay between each
    for (let i = 0; i < scrollCount; i++) {
      await this._browserOS.sendKeys(this._tabId, 'PageDown');
      
      // Add 50ms delay between scrolls (except after the last one)
      if (i < scrollCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  async scrollUp(amount?: number): Promise<void> {
    // If amount not specified, default to 1 viewport
    const scrollCount = amount || 1;
    
    // Scroll the specified number of viewports with delay between each
    for (let i = 0; i < scrollCount; i++) {
      await this._browserOS.sendKeys(this._tabId, 'PageUp');
      
      // Add 50ms delay between scrolls (except after the last one)
      if (i < scrollCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  // ============= Navigation =============

  async navigateTo(url: string): Promise<void> {
    await profileAsync('BrowserPage.navigateTo', async () => {
      await chrome.tabs.update(this._tabId, { url });
      this._invalidateCache();  // Invalidate cache on navigation
      await this.waitForStability();
      this._url = url;
    });
  }

  async refreshPage(): Promise<void> {
    await chrome.tabs.reload(this._tabId);
    this._invalidateCache();  // Invalidate cache on refresh
    await this.waitForStability();
  }

  async goBack(): Promise<void> {
    await chrome.tabs.goBack(this._tabId);
    this._invalidateCache();  // Invalidate cache on back navigation
    await this.waitForStability();
  }

  async goForward(): Promise<void> {
    await chrome.tabs.goForward(this._tabId);
    this._invalidateCache();  // Invalidate cache on forward navigation
    await this.waitForStability();
  }

  // ============= Utility =============

  /**
   * Manually invalidate the snapshot cache
   * Useful when external changes might have occurred
   */
  invalidateCache(): void {
    this._invalidateCache();
  }

  async waitForStability(): Promise<void> {
    await profileAsync('BrowserPage.waitForStability', async () => {
    // Wait for DOM content to be loaded AND resources to finish loading
    const maxWaitTime = 30000;  // 30 seconds max wait
    const pollInterval = 100;  // Check every 100ms
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this._browserOS.getPageLoadStatus(this._tabId);
        // Wait for both conditions: DOM loaded AND resources no longer loading
        if (status.isDOMContentLoaded) {//&& !status.isResourcesLoading) {
          Logging.log('BrowserPage', `Page fully loaded for tab ${this._tabId} (DOM loaded, resources finished)`, 'info');
          break;
        }
        
        // Log progress periodically
        if ((Date.now() - startTime) % 5000 < pollInterval) {
          Logging.log('BrowserPage', `Waiting for stability - DOM: ${status.isDOMContentLoaded}, Resources loading: ${status.isResourcesLoading}`, 'info');
        }
      } catch (error) {
        Logging.log('BrowserPage', `Error checking page load status: ${error}`, 'warning');
        break;  // Exit loop on error to avoid infinite waiting
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Log if we hit the timeout
    if (Date.now() - startTime >= maxWaitTime) {
      Logging.log('BrowserPage', `waitForStability timeout after ${maxWaitTime}ms for tab ${this._tabId}`, 'warning');
    }
    });
  }

  async takeScreenshot(): Promise<string | null> {
    try {
      const dataUrl = await this._browserOS.captureScreenshot(this._tabId);
      // Extract base64 data from data URL (remove the data:image/jpeg;base64, prefix)
      const base64Data = dataUrl.split(',')[1] || dataUrl;
      return base64Data;
    } catch (error) {
      Logging.log('BrowserPage', `Failed to take screenshot: ${error}`, 'error');
      return null;
    }
  }

  async close(): Promise<void> {
    try {
      await chrome.tabs.remove(this._tabId);
    } catch (error) {
      Logging.log('BrowserPage', `Error closing tab: ${error}`, 'error');
    }
  }

  // ============= Snapshot Extraction =============

  /**
   * Get text content snapshot from the page
   * @param options - Optional snapshot options (context, sections)
   * @returns Snapshot with text content from specified sections
   */
  async getTextSnapshot(options?: SnapshotOptions): Promise<Snapshot> {
    return await this._browserOS.getTextSnapshot(this._tabId, options);
  }

  /**
   * Get links snapshot from the page
   * @param options - Optional snapshot options (context, sections)
   * @returns Snapshot with links from specified sections
   */
  async getLinksSnapshot(options?: SnapshotOptions): Promise<Snapshot> {
    return await this._browserOS.getLinksSnapshot(this._tabId, options);
  }

  // ============= PDF Detection & Extraction =============
  private static readonly _DEFAULT_MAX_PDF_PAGES: number = 40;        // Max pages to parse
  private static readonly _MAX_PDF_BYTES: number = 25 * 1024 * 1024;  // 25MB cap
  private static readonly _DEFAULT_MAX_PDF_SHOTS: number = 6;         // Max screenshots for OCR fallback
  private static readonly _PDF_SCROLL_DELAY_MS: number = 200;         // Delay between shots

  /**
   * Determine if the current tab is showing a PDF (direct URL or Chrome PDF viewer)
   */
  async isPdf(): Promise<boolean> {
    try {
      const tab = await chrome.tabs.get(this._tabId);
      const currentUrl = tab.url || this._url || '';
      const lower = currentUrl.toLowerCase();
      if (lower.includes('.pdf')) return true;
      if (lower.includes('/pdf/')) return true;  // Common pattern (e.g., arXiv)
      if (lower.startsWith('chrome-extension://') && (lower.includes('pdf-viewer') || lower.includes('src='))) return true;
      // Best-effort HEAD probe for content-type
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(currentUrl, { method: 'HEAD', credentials: 'include', signal: controller.signal });
        clearTimeout(timeoutId);
        const ct = resp.headers.get('content-type') || '';
        if (ct.toLowerCase().includes('application/pdf')) return true;
      } catch (e) {
        Logging.log('BrowserPage', `PDF detection HEAD request failed: ${e instanceof Error ? e.message : String(e)}`, 'warning');
      }
      return false;
    } catch (e) {
      Logging.log('BrowserPage', `PDF detection failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
      return false;
    }
  }

  // Deprecated: background pdf.js extraction removed in favor of unified side-panel pdf.js path
  async getPdfText(_options?: { maxPages?: number }): Promise<string> {
    throw new Error('Background PDF extraction is disabled. Use side panel PDF parsing only.')
  }

  /**
   * Get total number of pages in the current PDF
   */
  async getPdfPageCount(): Promise<number> {
    const sourceUrl = await this._resolvePdfSourceUrl();
    const bytes = await this._fetchPdfBytes(sourceUrl);
    const doc = await (getDocument as any)({ data: bytes, isEvalSupported: false, disableWorker: true }).promise
    const num: number = typeof doc.numPages === 'number' ? doc.numPages : 0
    return num
  }

  /**
   * Public: get PDF bytes (with CORS/CDP fallbacks) for parsing in UI context
   */
  async getPdfBytes(): Promise<Uint8Array> {
    const sourceUrl = await this._resolvePdfSourceUrl()
    return await this._fetchPdfBytes(sourceUrl)
  }

  /**
   * Capture multiple screenshots of the PDF by paging down, for OCR/vision fallback
   */
  async getPdfScreenshots(maxShots: number = BrowserPage._DEFAULT_MAX_PDF_SHOTS): Promise<string[]> {
    const images: string[] = []
    for (let i = 0; i < maxShots; i++) {
      const img = await this.takeScreenshot()
      if (img) {
        // Avoid duplicates when end reached
        if (images.length === 0 || images[images.length - 1] !== img) {
          images.push(img)
        }
      }
      // Page down for next shot
      await this.sendKeys('PageDown')
      await new Promise(resolve => setTimeout(resolve, BrowserPage._PDF_SCROLL_DELAY_MS))
    }
    return images
  }

  // Resolve original PDF URL if viewing through Chrome's PDF viewer (src param)
  private async _resolvePdfSourceUrl(): Promise<string> {
    try {
      const tab = await chrome.tabs.get(this._tabId);
      const currentUrl = tab.url || this._url || '';
      if (currentUrl.startsWith('chrome-extension://')) {
        try {
          const u = new URL(currentUrl);
          const src = u.searchParams.get('src');
          if (src) return decodeURIComponent(src);
        } catch { /* ignore parse/decode */ }
      }
      return currentUrl;
    } catch {
      return this._url;
    }
  }

  // Fetch PDF bytes with credentialed fetch and enforce size limits
  private async _fetchPdfBytes(url: string): Promise<Uint8Array> {
    // Prefer CDP (what's actually loaded in the tab) to avoid network/referrer variance
    try {
      const bytes = await this._fetchPdfBytesViaDebugger(url)
      if (bytes && bytes.byteLength > 0) {
        const magic = new TextDecoder('latin1').decode(bytes.slice(0, 5))
        if (!magic.startsWith('%PDF-')) throw new Error('NON_PDF_CONTENT: first bytes are not %PDF')
        return bytes
      }
      throw new Error('DEBUGGER_FAILED: No content')
    } catch (e) {
      // Fallback to credentialed fetch
      const prior = e instanceof Error ? e.message : String(e)
      try {
        const resp = await fetch(url, { credentials: 'include', headers: { Accept: 'application/pdf' } })
        if (!resp.ok) throw new Error(`NETWORK_ERROR: HTTP ${resp.status}`)
        const contentLength = resp.headers.get('content-length')
        if (contentLength) {
          const size = parseInt(contentLength, 10)
          if (!Number.isNaN(size) && size > BrowserPage._MAX_PDF_BYTES) {
            throw new Error('PDF_TOO_LARGE: exceeds byte limit')
          }
        }
        const ab = await resp.arrayBuffer()
        if (ab.byteLength === 0) throw new Error('PDF is empty')
        if (ab.byteLength > BrowserPage._MAX_PDF_BYTES) {
          throw new Error('PDF_TOO_LARGE: exceeds byte limit')
        }
        const head = new TextDecoder('latin1').decode((ab as ArrayBuffer).slice(0, 5))
        if (!head.startsWith('%PDF-')) {
          throw new Error('NON_PDF_CONTENT: first bytes are not %PDF')
        }
        return new Uint8Array(ab)
      } catch (netErr) {
        const fb = netErr instanceof Error ? netErr.message : String(netErr)
        const combined = `${prior} | FETCH_FAILED: ${fb}`
        throw new Error(combined)
      }
    }
  }

  // Use CDP via chrome.debugger to retrieve resource bytes to bypass CORS
  private async _fetchPdfBytesViaDebugger(url: string): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      const target = { tabId: this._tabId } as chrome.debugger.Debuggee
      const version = '1.3'
      let attached = false

      const detach = () => {
        if (attached) {
          try {
            chrome.debugger.detach(target, () => {})
          } catch (error) {
            Logging.log('BrowserPage', `Debugger detach failed: ${error instanceof Error ? error.message : String(error)}`, 'warning')
          }
        }
      }

      try {
        chrome.debugger.attach(target, version, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
          attached = true
          chrome.debugger.sendCommand(target, 'Page.enable', {}, () => {
            if (chrome.runtime.lastError) {
              detach()
              reject(new Error(chrome.runtime.lastError.message))
              return
            }
            chrome.debugger.sendCommand(target, 'Page.getFrameTree', {}, (tree: any) => {
              if (chrome.runtime.lastError) {
                detach()
                reject(new Error(chrome.runtime.lastError.message))
                return
              }
              // Collect all frameIds (root + children) and try each for the resource content
              const collectFrameIds = (node: any, acc: string[] = []): string[] => {
                if (!node) return acc
                const id = node?.frame?.id || node?.frame?.frameId
                if (id) acc.push(id)
                const children = Array.isArray(node.childFrames) ? node.childFrames : []
                for (const ch of children) collectFrameIds(ch, acc)
                return acc
              }
              const frameIds: string[] = collectFrameIds(tree?.frameTree)
              const tryNext = (index: number) => {
                if (index >= frameIds.length) {
                  detach()
                  reject(new Error('No content'))
                  return
                }
                const fid = frameIds[index]
                chrome.debugger.sendCommand(target, 'Page.getResourceContent', { frameId: fid, url }, (res: any) => {
                  const lastErr2 = chrome.runtime.lastError
                  if (lastErr2 || !res || typeof res.content !== 'string') {
                    // Try next frame
                    tryNext(index + 1)
                    return
                  }
                  try {
                    const contentStr: string = res.content
                    const base64 = res.base64Encoded === true
                    const buffer = base64
                      ? Uint8Array.from(atob(contentStr), c => c.charCodeAt(0))
                      : new TextEncoder().encode(contentStr)
                    detach()
                    resolve(buffer)
                  } catch (err) {
                    detach()
                    reject(err as Error)
                  }
                })
              }
              tryNext(0)
            })
          })
        })
      } catch (err) {
        detach()
        reject(err as Error)
      }
    })
  }


  isFileUploader(element: any): boolean {
    return element.tagName === 'input' && 
           element.attributes?.['type'] === 'file';
  }

  async getDropdownOptions(_index: number): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async selectDropdownOption(_index: number, _text: string): Promise<string> {
    throw new Error('Not implemented');
  }

  /**
   * Get browser state - compatibility method
   */
  async getBrowserState(): Promise<any> {
    return {
      tabId: this._tabId,
      url: this._url,
      title: this._title
    };
  }
}

export default BrowserPage;
