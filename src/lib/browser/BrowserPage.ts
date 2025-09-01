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
import { profileAsync } from "@/lib/utils/Profiler";
import {
  ElementFormatter,
  type ElementDisplayConfig,
  PRESETS,
} from "./ElementFormatter";

// Default formatter for backwards compatibility
const DEFAULT_FORMATTER = new ElementFormatter("full");

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

  // Cache for the latest interactive snapshot
  private _cachedSnapshot: InteractiveSnapshot | null = null;
  // Map from nodeId to interactive node
  private _nodeIdToNodeMap: Map<number, InteractiveNode> = new Map();
  // Cache timestamp for expiry
  private _cacheTimestamp: number = 0;
  // Cache expiry duration in milliseconds (1 seconds)
  private readonly _cacheExpiryMs = 1000;

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
   * Invalidate the cached snapshot
   */
  private _invalidateCache(): void {
    this._cachedSnapshot = null;
    this._cacheTimestamp = 0;
    this._nodeIdToNodeMap.clear();
    Logging.log(
      "BrowserPage",
      `Cache invalidated for tab ${this._tabId}`,
      "info",
    );
  }

  /**
   * Check if the cached snapshot is still valid
   */
  private _isCacheValid(): boolean {
    //TODO: nikhil remove cache validation later
    return false;
    // return (
    //   this._cachedSnapshot !== null &&
    //   this._cacheTimestamp > 0 &&
    //   Date.now() - this._cacheTimestamp < this._cacheExpiryMs
    // );
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
        return this._cachedSnapshot;
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
        this._cachedSnapshot = snapshot;
        this._cacheTimestamp = Date.now();

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
    config?: ElementDisplayConfig,
  ): Promise<string> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return "";
    }

    const presetName = simplified ? "simplified" : "full";
    const formatter = new ElementFormatter(config || presetName);
    return formatter.formatElements(
      snapshot.elements,
      (node) => node.type === "clickable" || node.type === "selectable",
    );
  }

  /**
   * Get typeable elements as a formatted string
   */
  async getTypeableElementsString(
    simplified: boolean = false,
    config?: ElementDisplayConfig,
  ): Promise<string> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return "";
    }

    const presetName = simplified ? "simplified" : "full";
    const formatter = new ElementFormatter(config || presetName);
    return formatter.formatElements(
      snapshot.elements,
      (node) => node.type === "typeable",
    );
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
      this._invalidateCache(); // Invalidate cache after click
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
      this._invalidateCache(); // Invalidate cache after text input
      await this.waitForStability();
    });
  }

  /**
   * Clear element by node ID
   */
  async clearElement(nodeId: number): Promise<void> {
    await this._browserOS.clear(this._tabId, nodeId);
    this._invalidateCache(); // Invalidate cache after clearing
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

    // Only invalidate cache for keys that might change the DOM structure
    const domChangingKeys = ["Enter", "Delete", "Backspace", "Tab"];
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
      await this._browserOS.sendKeys(this._tabId, "PageDown");

      // Add 50ms delay between scrolls (except after the last one)
      if (i < scrollCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  async scrollUp(amount?: number): Promise<void> {
    // If amount not specified, default to 1 viewport
    const scrollCount = amount || 1;

    // Scroll the specified number of viewports with delay between each
    for (let i = 0; i < scrollCount; i++) {
      await this._browserOS.sendKeys(this._tabId, "PageUp");

      // Add 50ms delay between scrolls (except after the last one)
      if (i < scrollCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  // ============= Navigation =============

  async navigateTo(url: string): Promise<void> {
    await profileAsync("BrowserPage.navigateTo", async () => {
      await chrome.tabs.update(this._tabId, { url });
      this._invalidateCache(); // Invalidate cache on navigation
      await this.waitForStability();
      this._url = url;
    });
  }

  async refreshPage(): Promise<void> {
    await chrome.tabs.reload(this._tabId);
    this._invalidateCache(); // Invalidate cache on refresh
    await this.waitForStability();
  }

  async goBack(): Promise<void> {
    await chrome.tabs.goBack(this._tabId);
    this._invalidateCache(); // Invalidate cache on back navigation
    await this.waitForStability();
  }

  async goForward(): Promise<void> {
    await chrome.tabs.goForward(this._tabId);
    this._invalidateCache(); // Invalidate cache on forward navigation
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

  async takeScreenshot(size?: ScreenshotSizeKey): Promise<string | null> {
    try {
      // Return the full data URL directly from BrowserOS
      return await this._browserOS.captureScreenshot(this._tabId, size);
    } catch (error) {
      Logging.log(
        "BrowserPage",
        `Failed to take screenshot: ${error}`,
        "error",
      );
      return null;
    }
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

  // ============= Experimental Configuration Methods =============

  /**
   * Get elements with custom configuration for experimentation
   * @param config - Custom display configuration
   */
  async getElementsWithConfig(config: ElementDisplayConfig): Promise<string> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return "No interactive elements found";
    }

    const formatter = new ElementFormatter(config);
    return formatter.formatElements(snapshot.elements);
  }

  /**
   * Get elements as JSON format
   * @param separateByViewport - Whether to separate by viewport visibility
   */
  async getElementsAsJSON(separateByViewport: boolean = true): Promise<string> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return JSON.stringify({ elements: [] });
    }

    const formatter = new ElementFormatter({
      format: "json",
      separateByViewport,
    });
    return formatter.formatElements(snapshot.elements);
  }

  /**
   * Get elements with preset configuration
   * @param preset - Preset name: "simplified", "full", "minimal", "debug", "json", "compact"
   */
  async getElementsWithPreset(preset: keyof typeof PRESETS): Promise<string> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return "No interactive elements found";
    }

    const formatter = new ElementFormatter(preset);
    return formatter.formatElements(snapshot.elements);
  }

  /**
   * Get only visible elements (in viewport)
   * @param config - Optional display configuration
   */
  async getVisibleElements(config?: ElementDisplayConfig): Promise<string> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return "No interactive elements found";
    }

    const formatter = new ElementFormatter({
      ...config,
      separateByViewport: false, // Don't separate since we're filtering
    });

    return formatter.formatElements(
      snapshot.elements,
      (node) => node.attributes?.in_viewport !== "false",
    );
  }

  /**
   * Get elements sorted by a specific field
   * @param sortBy - Field to sort by
   * @param order - Sort order
   */
  async getElementsSorted(
    sortBy: "nodeId" | "name" | "type" | "depth",
    order: "asc" | "desc" = "asc",
  ): Promise<string> {
    const snapshot = await this._getSnapshot();
    if (!snapshot) {
      return "No interactive elements found";
    }

    const formatter = new ElementFormatter({
      sortBy,
      sortOrder: order,
    });

    return formatter.formatElements(snapshot.elements);
  }
}

export default BrowserPage;
