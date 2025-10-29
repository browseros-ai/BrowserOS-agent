import { z } from "zod";
import { type BrowserContextConfig } from "./BrowserContext";
import { Logging } from "../utils/Logging";
import {
  getBrowserOSAdapter,
  type InteractiveNode,
  type InteractiveSnapshot,
  type Snapshot,
  type SnapshotOptions,
  type ScreenshotSizeKey,
} from "./BrowserOSAdapter";
import { profileAsync } from "@/lib/utils/profiler";
import { ElementFormatter } from "./ElementFormatter";

// Default formatter instances
const FULL_FORMATTER = new ElementFormatter(false); // Full format
const SIMPLIFIED_FORMATTER = new ElementFormatter(true); // Simplified format


// Roles that contain meaningful content for extraction
const EXTRACTABLE_ROLES = new Set([
  // Text content
  'staticText',
  'heading',
  'paragraph',

  // Interactive elements
  'link',
  'button',
  'textField',
  'checkBox',
  'comboBoxSelect',

  // Labels and descriptions
  'labelText',
  'menuListOption',
  'toggleButton',

  // Informational
  'status',
  'alert',
  'image',  // May have alt text in name

  // High-level structure (for context)
  'rootWebArea',
  'navigation',
  'main'
]);

// Schema for interactive elements
export const InteractiveElementSchema = z.object({
  nodeId: z.number(), // Chrome BrowserOS node ID (sequential index)
  text: z.string(), // Element text (axName or tag)
  tag: z.string(), // HTML tag name
});

export type InteractiveElement = z.infer<typeof InteractiveElementSchema>;

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

  // Snapshot cache for the latest interactive snapshot
  private _snapshotCache: InteractiveSnapshot | null = null;
  // Map from nodeId to interactive node
  private _nodeIdToNodeMap: Map<number, InteractiveNode> = new Map();
  // Snapshot cache timestamp for expiry
  private _snapshotCacheTimestamp: number = 0;
  // Snapshot cache TTL in milliseconds (100ms default)
  private readonly _snapshotCacheTTL = 100;

  constructor(tabId: number, url: string, title: string) {
    this._tabId = tabId;
    this._url = url;
    this._title = title;

    Logging.log("BrowserPage", `Page created for tab ${this._tabId}`);
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
      this._title = tab.title || "";
      return this._title;
    } catch {
      return this._title;
    }
  }

  // ============= Core BrowserOS Integration =============

  /**
   * Invalidate the snapshot cache
   */
  private _invalidateCache(): void {
    this._snapshotCache = null;
    this._snapshotCacheTimestamp = 0;
    this._nodeIdToNodeMap.clear();
    Logging.log(
      "BrowserPage",
      `Snapshot cache invalidated for tab ${this._tabId}`,
      "info",
    );
  }

  /**
   * Check if the snapshot cache is still valid
   */
  private _isCacheValid(): boolean {
    return (
      this._snapshotCache !== null &&
      this._snapshotCacheTimestamp > 0 &&
      Date.now() - this._snapshotCacheTimestamp < this._snapshotCacheTTL
    );
  }

  /**
   * Get interactive snapshot and update cache
   */
  private async _getSnapshot(): Promise<InteractiveSnapshot | null> {
    return profileAsync("BrowserPage._getSnapshot", async () => {
      // Return cached snapshot if still valid
      if (this._isCacheValid()) {
        Logging.log(
          "BrowserPage",
          `Using cached snapshot for tab ${this._tabId}`,
          "info",
        );
        return this._snapshotCache;
      }

      try {
        Logging.log(
          "BrowserPage",
          `Fetching fresh snapshot for tab ${this._tabId}`,
          "info",
        );
        const snapshot = await this._browserOS.getInteractiveSnapshot(
          this._tabId,
        );
        this._snapshotCache = snapshot;
        this._snapshotCacheTimestamp = Date.now();

        // Rebuild nodeId map for interactive elements only
        this._nodeIdToNodeMap.clear();
        for (const node of snapshot.elements) {
          if (
            node.type === "clickable" ||
            node.type === "typeable" ||
            node.type === "selectable"
          ) {
            this._nodeIdToNodeMap.set(node.nodeId, node);
          }
        }

        return snapshot;
      } catch (error) {
        Logging.log("BrowserPage", `Failed to get snapshot: ${error}`, "error");
        this._invalidateCache();
        return null;
      }
    });
  }

  /**
   * Get clickable elements as a formatted string
   */
  async getClickableElementsString(
    simplified: boolean = false,
    hideHiddenElements: boolean = false,
  ): Promise<string> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return "";
    }

    const formatter = simplified ? SIMPLIFIED_FORMATTER : FULL_FORMATTER;
    const clickables = snapshot.elements.filter(
      (node) => node.type === "clickable" || node.type === "selectable",
    );
    return formatter.formatElements(clickables, hideHiddenElements);
  }

  /**
   * Get typeable elements as a formatted string
   */
  async getTypeableElementsString(
    simplified: boolean = false,
    hideHiddenElements: boolean = false,
  ): Promise<string> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return "";
    }

    const formatter = simplified ? SIMPLIFIED_FORMATTER : FULL_FORMATTER;
    const typeables = snapshot.elements.filter(
      (node) => node.type === "typeable",
    );
    return formatter.formatElements(typeables, hideHiddenElements);
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
      if (node.type === "clickable" || node.type === "selectable") {
        clickableElements.push({
          nodeId: node.nodeId,
          text: node.name || "",
          tag: node.attributes?.["html-tag"] || node.attributes?.role || "",
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
      if (node.type === "typeable") {
        typeableElements.push({
          nodeId: node.nodeId,
          text: node.name || "",
          tag: node.attributes?.["html-tag"] || node.attributes?.role || "",
        });
      }
    }

    return typeableElements;
  }

  /**
   * Get element by nodeId
   */
  async getElementByIndex(nodeId: number): Promise<InteractiveNode | null> {
    if (!this._snapshotCache) {
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

  /**
   * Get hierarchical text representation of the page
   * Returns text content with tab indentation showing structure
   */
  async getHierarchicalText(): Promise<string> {
    // Get accessibility tree from BrowserOS adapter
    const tree = await this._browserOS.getAccessibilityTree(this._tabId);

    // Extract text with hierarchy
    return this._extractHierarchicalText(tree);
  }

  /**
   * Private method to extract text from accessibility tree with tab indentation
   * Uses iterative DFS to build a hierarchical text representation
   */
  private _extractHierarchicalText(tree: chrome.browserOS.AccessibilityTree): string {
    // Validate tree structure
    if (!tree || !tree.nodes || !tree.rootId) {
      Logging.log("BrowserPage", "Invalid accessibility tree structure", "warning");
      return "";
    }

    const lines: string[] = [];

    // Stack for iterative DFS
    const stack: Array<{ nodeId: number; depth: number }> = [];
    stack.push({ nodeId: tree.rootId, depth: 0 });

    // Process nodes using DFS
    while (stack.length > 0) {
      const { nodeId, depth } = stack.pop()!;

      // Get node (keys are strings)
      const node = tree.nodes[String(nodeId)];
      if (!node) continue;

      // Add text line if node has extractable role and name
      if (EXTRACTABLE_ROLES.has(node.role) && node.name) {
        const indentation = '\t'.repeat(depth);
        lines.push(`${indentation}${node.name}`);
      }

      // Always traverse children to maintain hierarchy
      // Add in reverse order for correct DFS traversal
      if (node.childIds && Array.isArray(node.childIds)) {
        for (let i = node.childIds.length - 1; i >= 0; i--) {
          stack.push({
            nodeId: node.childIds[i],
            depth: depth + 1
          });
        }
      }
    }

    const result = lines.join('\n');

    Logging.log(
      "BrowserPage",
      `Extracted hierarchical text: ${lines.length} lines`,
      "info"
    );

    return result;
  }

  // ============= Actions =============

  /**
   * Show visual pointer for an element before performing an action
   * @param nodeId - The node ID to show pointer for
   * @param action - The action being performed (Click, Type, Clear)
   * @returns Promise<void>
   */
  private async _showPointerForElement(
    nodeId: number,
    action: string,
  ): Promise<void> {
    try {
      // Get the element
      const element = await this.getElementByIndex(nodeId);
      if (!element || !element.rect) {
        // No element or no coordinates, skip pointer
        return;
      }

      const rect = element.rect;
      let x: number;
      let y: number;

      // Calculate pointer position based on action type
      switch (action.toLowerCase()) {
        case "click":
          // Center of element
          x = rect.x + rect.width / 2;
          y = rect.y + rect.height / 2;
          break;
        case "type":
        case "input":
          // Left-center of element (where text cursor typically appears)
          x = rect.x + 10;
          y = rect.y + rect.height / 2;
          break;
        case "clear":
          // Right side of element (near clear button if present)
          x = rect.x + rect.width - 10;
          y = rect.y + rect.height / 2;
          break;
        default:
          // Default to center
          x = rect.x + rect.width / 2;
          y = rect.y + rect.height / 2;
      }

      // Show the pointer with action description
      await this.showPointer(x, y, action);
    } catch (error) {
      // Log but don't fail the action if pointer fails
      Logging.log(
        "BrowserPage",
        `Failed to show pointer for element ${nodeId}: ${error}`,
        "warning",
      );
    }
  }

  /**
   * Click element by node ID
   */
  async clickElement(nodeId: number): Promise<void> {
    await profileAsync(`BrowserPage.clickElement[${nodeId}]`, async () => {
      // Show pointer before clicking
      await this._showPointerForElement(nodeId, "Click");
      await this._browserOS.click(this._tabId, nodeId);
      await this.waitForStability();
      this._invalidateCache(); // Invalidate cache after stability
    });
  }

  /**
   * Input text by node ID
   */
  async inputText(nodeId: number, text: string): Promise<void> {
    await profileAsync(`BrowserPage.inputText[${nodeId}]`, async () => {
      // Show pointer before typing, with preview of text
      const displayText = text.length > 20 ? `${text.substring(0, 20)}...` : text;
      await this._showPointerForElement(nodeId, `Type: ${displayText}`);
      await this._browserOS.clear(this._tabId, nodeId);
      await this._browserOS.inputText(this._tabId, nodeId, text);
      await this.waitForStability();
      this._invalidateCache(); // Invalidate cache after stability
    });
  }

  /**
   * Clear element by node ID
   */
  async clearElement(nodeId: number): Promise<void> {
    // Show pointer before clearing
    await this._showPointerForElement(nodeId, "Clear");
    await this._browserOS.clear(this._tabId, nodeId);
    await this.waitForStability();
    this._invalidateCache(); // Invalidate cache after stability
  }

  /**
   * Scroll to element by node ID
   */
  async scrollToElement(nodeId: number): Promise<boolean> {
    return await this._browserOS.scrollToNode(this._tabId, nodeId);
  }

  /**
   * Ensures element is in viewport, scrolling if necessary
   * @param nodeId - The node ID to check and potentially scroll to
   * @returns Object with element and scroll status
   */
  async ensureElementInViewport(nodeId: number): Promise<{
    element: InteractiveNode | null;
    scrollMessage: string;
  }> {
    // Get element
    const element = await this.getElementByIndex(nodeId);
    if (!element) {
      return {
        element: null,
        scrollMessage: "",
      };
    }

    // Check if out of viewport and scroll if needed
    let scrollMessage = "";
    if (element.attributes?.in_viewport === "false") {
      const scrolled = await this.scrollToElement(nodeId);

      // Wait for scroll to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Force refresh snapshot after scrolling
      this._invalidateCache();
      await this._getSnapshot();

      scrollMessage = scrolled
        ? " (auto-scrolled to element)"
        : " (attempted scroll)";

      // Show pointer at the element after scrolling
      if (scrolled && element.rect) {
        const x = element.rect.x + element.rect.width / 2;
        const y = element.rect.y + element.rect.height / 2;
        await this.showPointer(x, y, "Scrolled to element");
      }
    }

    return {
      element,
      scrollMessage,
    };
  }

  /**
   * Send keyboard keys
   */
  async sendKeys(keys: string): Promise<void> {
    // Define supported keys based on chrome.browserOS.Key type
    const supportedKeys = [
      "Enter",
      "Delete",
      "Backspace",
      "Tab",
      "Escape",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ];

    if (!supportedKeys.includes(keys)) {
      throw new Error(
        `Unsupported key: "${keys}". Supported keys are: ${supportedKeys.join(", ")}`,
      );
    }

    await this._browserOS.sendKeys(this._tabId, keys as chrome.browserOS.Key);

    await this.waitForStability();

    // Only invalidate cache for keys that might change the DOM structure
    const domChangingKeys = ["Enter", "Delete", "Backspace", "Tab"];
    if (domChangingKeys.includes(keys)) {
      this._invalidateCache();
    }
  }

  /**
   * Scroll page up/down
   */
  async scrollDown(amount?: number): Promise<{ didScroll: boolean }> {
    // If amount not specified, default to 1 viewport
    const scrollCount = amount || 1;

    // Get initial scroll position
    const initialScrollY = await this.executeJavaScript('window.scrollY');

    // Scroll the specified number of viewports with delay between each
    for (let i = 0; i < scrollCount; i++) {
      await this._browserOS.sendKeys(this._tabId, "PageDown");

      // Add 50ms delay between scrolls (except after the last one)
      if (i < scrollCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // Wait a bit for scroll to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Get final scroll position
    const finalScrollY = await this.executeJavaScript('window.scrollY');

    // Check if position changed
    const didScroll = finalScrollY > initialScrollY;

    return { didScroll };
  }

  async scrollUp(amount?: number): Promise<{ didScroll: boolean }> {
    // If amount not specified, default to 1 viewport
    const scrollCount = amount || 1;

    // Get initial scroll position
    const initialScrollY = await this.executeJavaScript('window.scrollY');

    // Scroll the specified number of viewports with delay between each
    for (let i = 0; i < scrollCount; i++) {
      await this._browserOS.sendKeys(this._tabId, "PageUp");

      // Add 50ms delay between scrolls (except after the last one)
      if (i < scrollCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // Wait a bit for scroll to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Get final scroll position
    const finalScrollY = await this.executeJavaScript('window.scrollY');

    // Check if position changed
    const didScroll = finalScrollY < initialScrollY;

    return { didScroll };
  }

  // ============= Navigation =============

  async navigateTo(url: string): Promise<void> {
    await profileAsync("BrowserPage.navigateTo", async () => {
      await chrome.tabs.update(this._tabId, { url });
      await this.waitForStability();
      this._invalidateCache(); // Invalidate cache after stability
      this._url = url;
    });
  }

  async refreshPage(): Promise<void> {
    await chrome.tabs.reload(this._tabId);
    await this.waitForStability();
    this._invalidateCache(); // Invalidate cache after stability
  }

  async goBack(): Promise<void> {
    await chrome.tabs.goBack(this._tabId);
    await this.waitForStability();
    this._invalidateCache(); // Invalidate cache after stability
  }

  async goForward(): Promise<void> {
    await chrome.tabs.goForward(this._tabId);
    await this.waitForStability();
    this._invalidateCache(); // Invalidate cache after stability
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
    // CRITICAL: Add delay for Chrome browserOS to update internal state after actions
    // Chrome's accessibility tree and element indexing may need time to reflect DOM changes
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await profileAsync("BrowserPage.waitForStability", async () => {
      // Wait for DOM content to be loaded AND resources to finish loading
      const maxWaitTime = 30000; // 30 seconds max wait
      const pollInterval = 100; // Check every 100ms
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        try {
          const status = await this._browserOS.getPageLoadStatus(this._tabId);
          // Wait for both conditions: DOM loaded AND resources no longer loading
          if (status.isDOMContentLoaded) {
            //&& !status.isResourcesLoading) {
            Logging.log(
              "BrowserPage",
              `Page fully loaded for tab ${this._tabId} (DOM loaded, resources finished)`,
              "info",
            );
            break;
          }

          // Log progress periodically
          if ((Date.now() - startTime) % 5000 < pollInterval) {
            Logging.log(
              "BrowserPage",
              `Waiting for stability - DOM: ${status.isDOMContentLoaded}, Resources loading: ${status.isResourcesLoading}`,
              "info",
            );
          }
        } catch (error) {
          Logging.log(
            "BrowserPage",
            `Error checking page load status: ${error}`,
            "warning",
          );
          break; // Exit loop on error to avoid infinite waiting
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      // Log if we hit the timeout
      if (Date.now() - startTime >= maxWaitTime) {
        Logging.log(
          "BrowserPage",
          `waitForStability timeout after ${maxWaitTime}ms for tab ${this._tabId}`,
          "warning",
        );
      }
    });
  }

  async takeScreenshot(
    size?: ScreenshotSizeKey,
    showHighlights?: boolean,
  ): Promise<string | null> {
    try {
      // Return the full data URL directly from BrowserOS
      return await this._browserOS.captureScreenshot(
        this._tabId,
        size,
        showHighlights,
      );
    } catch (error) {
      Logging.log(
        "BrowserPage",
        `Failed to take screenshot: ${error}`,
        "error",
      );
      return null;
    }
  }

  /**
   * Take a screenshot with specific dimensions
   * @param width - The exact width of the screenshot
   * @param height - The exact height of the screenshot
   * @param showHighlights - Optional flag to show element highlights
   * @returns The screenshot as a data URL or null on failure
   */
  async takeScreenshotWithDimensions(
    width: number,
    height: number,
    showHighlights?: boolean,
  ): Promise<string | null> {
    try {
      // Return the full data URL directly from BrowserOS with exact dimensions
      return await this._browserOS.captureScreenshot(
        this._tabId,
        undefined, // size is undefined when using exact dimensions
        showHighlights,
        width,
        height,
      );
    } catch (error) {
      Logging.log(
        "BrowserPage",
        `Failed to take screenshot with dimensions: ${error}`,
        "error",
      );
      return null;
    }
  }

  /**
   * Execute JavaScript code in the page context
   * @param code - The JavaScript code to execute
   * @returns The result of the execution
   */
  async executeJavaScript(code: string): Promise<any> {
    try {
      return await this._browserOS.executeJavaScript(this._tabId, code);
    } catch (error) {
      Logging.log(
        "BrowserPage",
        `Failed to execute JavaScript: ${error}`,
        "error",
      );
      throw error;
    }
  }

  /**
   * Click at specific viewport coordinates
   * @param x - X coordinate in viewport pixels
   * @param y - Y coordinate in viewport pixels
   */
  async clickAtCoordinates(x: number, y: number): Promise<void> {
    await profileAsync(
      `BrowserPage.clickAtCoordinates[${x},${y}]`,
      async () => {
        // Show pointer before clicking
        await this.showPointer(x, y, "Click");
        await this._browserOS.clickCoordinates(this._tabId, x, y);
        await this.waitForStability();
        this._invalidateCache(); // Invalidate cache after stability
      },
    );
  }

  /**
   * Type text at specific viewport coordinates
   * Clicks at the location first to ensure focus, then types the text
   * @param x - X coordinate in viewport pixels
   * @param y - Y coordinate in viewport pixels
   * @param text - Text to type at the location
   */
  async typeAtCoordinates(x: number, y: number, text: string): Promise<void> {
    await profileAsync(`BrowserPage.typeAtCoordinates[${x},${y}]`, async () => {
      // Show pointer before typing
      await this.showPointer(x, y, `Type: ${text.substring(0, 20)}`);
      // First click to focus the element at coordinates
      // await this._browserOS.clickAtCoordinates(this._tabId, x, y);
      // Small delay to ensure focus is established
      // await new Promise(resolve => setTimeout(resolve, 100));
      // Then type the text
      await this._browserOS.typeAtCoordinates(this._tabId, x, y, text);
      await this.waitForStability();
      this._invalidateCache(); // Invalidate cache after stability
    });
  }

  /**
   * Shows a visual pointer at coordinates with optional text
   * Auto-removes after 3 seconds
   */
  async showPointer(x: number, y: number, text?: string): Promise<void> {
    const pointerId = `nxtscape-pointer-${Date.now()}`;

    await this.executeJavaScript(`
      (function() {
        // Remove any existing pointer
        const existing = document.querySelector('.nxtscape-pointer');
        if (existing) existing.remove();
        
        // Create pointer container
        const pointer = document.createElement('div');
        pointer.className = 'nxtscape-pointer';
        pointer.id = '${pointerId}';
        
        // Style the pointer container
        pointer.style.cssText = \`
          position: fixed;
          left: \${${x}}px;
          top: \${${y}}px;
          z-index: 2147483647;
          pointer-events: none;
        \`;
        
        // Create large CSS arrow cursor
        const arrow = document.createElement('div');
        arrow.style.cssText = \`
          position: absolute;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 12px 20px 12px;
          border-color: transparent transparent #FB6618 transparent;
          transform: translate(-3px, -3px) rotate(45deg);
          filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.4));
        \`;
        pointer.appendChild(arrow);
        
        // Add optional text label
        ${
          text
            ? `
        const label = document.createElement('div');
        label.textContent = '${text.replace(/'/g, "\\'")}';
        label.style.cssText = \`
          position: absolute;
          top: 20px;
          left: 12px;
          background: rgba(0,0,0,0.9);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          font-family: monospace;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        \`;
        pointer.appendChild(label);
        `
            : ""
        }
        
        document.body.appendChild(pointer);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
          const el = document.getElementById('${pointerId}');
          if (el) el.remove();
        }, 3000);
      })();
    `);
  }

  async close(): Promise<void> {
    try {
      await chrome.tabs.remove(this._tabId);
    } catch (error) {
      Logging.log("BrowserPage", `Error closing tab: ${error}`, "error");
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

  /**
   * Get text content as a simple string
   * @param options - Optional snapshot options
   * @returns Plain text string from all sections
   */
  async getTextSnapshotString(options?: SnapshotOptions): Promise<string> {
    const snapshot = await this.getTextSnapshot(options);

    // Extract text from all sections
    const textParts: string[] = [];

    for (const section of snapshot.sections) {
      if (section.textResult?.text) {
        textParts.push(section.textResult.text);
      }
    }

    // Join with double newline for readability
    return textParts.join("\n\n").trim();
  }

  /**
   * Get links as a simple formatted string
   * @param options - Optional snapshot options
   * @returns Formatted string with link text and URLs
   */
  async getLinksSnapshotString(options?: SnapshotOptions): Promise<string> {
    const snapshot = await this.getLinksSnapshot(options);

    // Extract all links from sections
    const linkStrings: string[] = [];

    for (const section of snapshot.sections) {
      if (section.linksResult?.links) {
        for (const link of section.linksResult.links) {
          // Format: "text: url" or just "url" if no text
          const linkStr = link.text ? `${link.text}: ${link.url}` : link.url;
          linkStrings.push(linkStr);
        }
      }
    }

    // Join with newlines, no duplicates
    return [...new Set(linkStrings)].join("\n").trim();
  }

  isFileUploader(element: any): boolean {
    return (
      element.tagName === "input" && element.attributes?.["type"] === "file"
    );
  }

  async getDropdownOptions(_index: number): Promise<any[]> {
    throw new Error("Not implemented");
  }

  async selectDropdownOption(_index: number, _text: string): Promise<string> {
    throw new Error("Not implemented");
  }

  /**
   * Get page details including URL, title, and tab ID
   */
  async getPageDetails(): Promise<{
    url: string;
    title: string;
    tabId: number;
  }> {
    // Get fresh tab data from Chrome API
    try {
      const tab = await chrome.tabs.get(this._tabId);
      this._url = tab.url || this._url;
      this._title = tab.title || this._title;
    } catch (error) {
      Logging.log(
        "BrowserPage",
        `Error getting tab details: ${error}`,
        "warning",
      );
    }

    return {
      url: this._url,
      title: this._title,
      tabId: this._tabId,
    };
  }
}

export default BrowserPage;
