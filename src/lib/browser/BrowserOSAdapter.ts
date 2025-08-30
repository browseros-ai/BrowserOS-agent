/// <reference path="../../types/chrome-browser-os.d.ts" />

// ============= Re-export types from chrome.browserOS namespace =============

export type InteractiveNode = chrome.browserOS.InteractiveNode;
export type InteractiveSnapshot = chrome.browserOS.InteractiveSnapshot;
export type InteractiveSnapshotOptions = chrome.browserOS.InteractiveSnapshotOptions;
export type PageLoadStatus = chrome.browserOS.PageLoadStatus;
export type InteractiveNodeType = chrome.browserOS.InteractiveNodeType;
export type Rect = chrome.browserOS.BoundingRect;

// New snapshot types
export type SnapshotType = chrome.browserOS.SnapshotType;
export type SnapshotContext = chrome.browserOS.SnapshotContext;
export type SectionType = chrome.browserOS.SectionType;
export type TextSnapshotResult = chrome.browserOS.TextSnapshotResult;
export type LinkInfo = chrome.browserOS.LinkInfo;
export type LinksSnapshotResult = chrome.browserOS.LinksSnapshotResult;
export type SnapshotSection = chrome.browserOS.SnapshotSection;
export type Snapshot = chrome.browserOS.Snapshot;
export type SnapshotOptions = chrome.browserOS.SnapshotOptions;

// ============= BrowserOS Adapter =============

// Screenshot size constants
export const SCREENSHOT_SIZES = {
  small: 256,   // Low token usage
  medium: 512,  // Balanced (default)
  large: 1028   // High detail (note: 1028 not 1024)
} as const;

export type ScreenshotSizeKey = keyof typeof SCREENSHOT_SIZES;

/**
 * Adapter for Chrome BrowserOS Extension APIs
 * Provides a clean interface to browserOS functionality with extensibility
 */
export class BrowserOSAdapter {
  private static instance: BrowserOSAdapter | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): BrowserOSAdapter {
    if (!BrowserOSAdapter.instance) {
      BrowserOSAdapter.instance = new BrowserOSAdapter();
    }
    return BrowserOSAdapter.instance;
  }

  /**
   * Get interactive snapshot of the current page
   */
  async getInteractiveSnapshot(tabId: number, options?: InteractiveSnapshotOptions): Promise<InteractiveSnapshot> {
    try {
      console.log(`[BrowserOSAdapter] Getting interactive snapshot for tab ${tabId} with options: ${JSON.stringify(options)}`);
      
      return new Promise<InteractiveSnapshot>((resolve, reject) => {
        if (options) {
          chrome.browserOS.getInteractiveSnapshot(
            tabId,
            options,
            (snapshot: InteractiveSnapshot) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log(`[BrowserOSAdapter] Retrieved snapshot with ${snapshot.elements.length} elements`);
                resolve(snapshot);
              }
            }
          );
        } else {
          chrome.browserOS.getInteractiveSnapshot(
            tabId,
            (snapshot: InteractiveSnapshot) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log(`[BrowserOSAdapter] Retrieved snapshot with ${snapshot.elements.length} elements`);
                resolve(snapshot);
              }
            }
          );
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to get interactive snapshot: ${errorMessage}`);
      throw new Error(`Failed to get interactive snapshot: ${errorMessage}`);
    }
  }

  /**
   * Click an element by node ID
   */
  async click(tabId: number, nodeId: number): Promise<void> {
    try {
      console.log(`[BrowserOSAdapter] Clicking node ${nodeId} in tab ${tabId}`);
      
      return new Promise<void>((resolve, reject) => {
        chrome.browserOS.click(tabId, nodeId, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to click node: ${errorMessage}`);
      throw new Error(`Failed to click node ${nodeId}: ${errorMessage}`);
    }
  }

  /**
   * Input text into an element
   */
  async inputText(tabId: number, nodeId: number, text: string): Promise<void> {
    try {
      console.log(`[BrowserOSAdapter] Inputting text into node ${nodeId} in tab ${tabId}`);
      
      return new Promise<void>((resolve, reject) => {
        chrome.browserOS.inputText(tabId, nodeId, text, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to input text: ${errorMessage}`);
      throw new Error(`Failed to input text into node ${nodeId}: ${errorMessage}`);
    }
  }

  /**
   * Clear text from an element
   */
  async clear(tabId: number, nodeId: number): Promise<void> {
    try {
      console.log(`[BrowserOSAdapter] Clearing node ${nodeId} in tab ${tabId}`);
      
      return new Promise<void>((resolve, reject) => {
        chrome.browserOS.clear(tabId, nodeId, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to clear node: ${errorMessage}`);
      throw new Error(`Failed to clear node ${nodeId}: ${errorMessage}`);
    }
  }

  /**
   * Scroll to a specific node
   */
  async scrollToNode(tabId: number, nodeId: number): Promise<boolean> {
    try {
      console.log(`[BrowserOSAdapter] Scrolling to node ${nodeId} in tab ${tabId}`);
      
      return new Promise<boolean>((resolve, reject) => {
        chrome.browserOS.scrollToNode(tabId, nodeId, (scrolled: boolean) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(scrolled);
          }
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to scroll to node: ${errorMessage}`);
      throw new Error(`Failed to scroll to node ${nodeId}: ${errorMessage}`);
    }
  }

  /**
   * Send keyboard keys
   */
  async sendKeys(tabId: number, keys: chrome.browserOS.Key): Promise<void> {
    try {
      console.log(`[BrowserOSAdapter] Sending keys "${keys}" to tab ${tabId}`);
      
      return new Promise<void>((resolve, reject) => {
        chrome.browserOS.sendKeys(tabId, keys, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to send keys: ${errorMessage}`);
      throw new Error(`Failed to send keys: ${errorMessage}`);
    }
  }

  /**
   * Get page load status
   */
  async getPageLoadStatus(tabId: number): Promise<PageLoadStatus> {
    try {
      console.log(`[BrowserOSAdapter] Getting page load status for tab ${tabId}`);
      
      return new Promise<PageLoadStatus>((resolve, reject) => {
        chrome.browserOS.getPageLoadStatus(tabId, (status: PageLoadStatus) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(status);
          }
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to get page load status: ${errorMessage}`);
      throw new Error(`Failed to get page load status: ${errorMessage}`);
    }
  }

  /**
   * Get accessibility tree (if available)
   */
  async getAccessibilityTree(tabId: number): Promise<chrome.browserOS.AccessibilityTree> {
    try {
      console.log(`[BrowserOSAdapter] Getting accessibility tree for tab ${tabId}`);
      
      return new Promise<chrome.browserOS.AccessibilityTree>((resolve, reject) => {
        chrome.browserOS.getAccessibilityTree(tabId, (tree: chrome.browserOS.AccessibilityTree) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(tree);
          }
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to get accessibility tree: ${errorMessage}`);
      throw new Error(`Failed to get accessibility tree: ${errorMessage}`);
    }
  }

  /**
   * Capture a screenshot of the tab
   * @param tabId - The tab ID to capture
   * @param size - Optional screenshot size ('small', 'medium', or 'large')
   */
  async captureScreenshot(tabId: number, size?: ScreenshotSizeKey): Promise<string> {
    try {
      const sizeDesc = size ? ` (${size})` : '';
      console.log(`[BrowserOSAdapter] Capturing screenshot for tab ${tabId}${sizeDesc}`);
      
      return new Promise<string>((resolve, reject) => {
        // Convert size string to pixels only when calling Chrome API
        if (size !== undefined) {
          const pixelSize = SCREENSHOT_SIZES[size];
          // Use the new API with thumbnail size
          chrome.browserOS.captureScreenshot(tabId, pixelSize, (dataUrl: string) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              console.log(`[BrowserOSAdapter] Screenshot captured for tab ${tabId} (${size}: ${pixelSize}px)`);
              resolve(dataUrl);
            }
          });
        } else {
          // Use the original API without size (backwards compatibility)
          chrome.browserOS.captureScreenshot(tabId, (dataUrl: string) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              console.log(`[BrowserOSAdapter] Screenshot captured for tab ${tabId}`);
              resolve(dataUrl);
            }
          });
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to capture screenshot: ${errorMessage}`);
      throw new Error(`Failed to capture screenshot: ${errorMessage}`);
    }
  }

  /**
   * Get a content snapshot of the specified type from the page
   */
  async getSnapshot(tabId: number, type: SnapshotType, options?: SnapshotOptions): Promise<Snapshot> {
    try {
      console.log(`[BrowserOSAdapter] Getting ${type} snapshot for tab ${tabId} with options: ${JSON.stringify(options)}`);
      
      return new Promise<Snapshot>((resolve, reject) => {
        if (options) {
          chrome.browserOS.getSnapshot(
            tabId,
            type,
            options,
            (snapshot: Snapshot) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log(`[BrowserOSAdapter] Retrieved ${type} snapshot with ${snapshot.sections.length} sections`);
                resolve(snapshot);
              }
            }
          );
        } else {
          chrome.browserOS.getSnapshot(
            tabId,
            type,
            (snapshot: Snapshot) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log(`[BrowserOSAdapter] Retrieved ${type} snapshot with ${snapshot.sections.length} sections`);
                resolve(snapshot);
              }
            }
          );
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to get ${type} snapshot: ${errorMessage}`);
      throw new Error(`Failed to get ${type} snapshot: ${errorMessage}`);
    }
  }

  /**
   * Get text content snapshot from the page
   * Convenience method for text snapshot
   */
  async getTextSnapshot(tabId: number, options?: SnapshotOptions): Promise<Snapshot> {
    return this.getSnapshot(tabId, 'text', options);
  }

  /**
   * Get links snapshot from the page
   * Convenience method for links snapshot
   */
  async getLinksSnapshot(tabId: number, options?: SnapshotOptions): Promise<Snapshot> {
    return this.getSnapshot(tabId, 'links', options);
  }

  /**
   * Generic method to invoke any BrowserOS API
   * Useful for future APIs or experimental features
   */
  async invokeAPI(method: string, ...args: any[]): Promise<any> {
    try {
      console.log(`[BrowserOSAdapter] Invoking BrowserOS API: ${method}`);
      
      if (!(method in chrome.browserOS)) {
        throw new Error(`Unknown BrowserOS API method: ${method}`);
      }
      
      // @ts-expect-error - Dynamic API invocation
      const result = await chrome.browserOS[method](...args);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to invoke API ${method}: ${errorMessage}`);
      throw new Error(`Failed to invoke BrowserOS API ${method}: ${errorMessage}`);
    }
  }

  /**
   * Check if a specific API is available
   */
  isAPIAvailable(method: string): boolean {
    return method in chrome.browserOS;
  }

  /**
   * Get list of available BrowserOS APIs
   */
  getAvailableAPIs(): string[] {
    return Object.keys(chrome.browserOS).filter(key => {
      // @ts-expect-error - Dynamic key access for API discovery
      return typeof chrome.browserOS[key] === 'function';
    });
  }

  /**
   * Get BrowserOS version information
   */
  async getVersion(): Promise<string | null> {
    try {
      console.log('[BrowserOSAdapter] Getting BrowserOS version');
      
      return new Promise<string | null>((resolve, reject) => {
        // Check if getVersionNumber API is available
        if ('getVersionNumber' in chrome.browserOS && typeof chrome.browserOS.getVersionNumber === 'function') {
          chrome.browserOS.getVersionNumber((version: string) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              console.log(`[BrowserOSAdapter] BrowserOS version: ${version}`);
              resolve(version);
            }
          });
        } else {
          // Fallback - return null if API not available
          resolve(null);
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to get version: ${errorMessage}`);
      // Return null on error
      return null;
    }
  }

  /**
   * Log a metric event with optional properties
   */
  async logMetric(eventName: string, properties?: Record<string, any>): Promise<void> {
    try {
      console.log(`[BrowserOSAdapter] Logging metric: ${eventName} with properties: ${JSON.stringify(properties)}`);
      
      return new Promise<void>((resolve, reject) => {
        // Check if logMetric API is available
        if ('logMetric' in chrome.browserOS && typeof chrome.browserOS.logMetric === 'function') {
          if (properties) {
            chrome.browserOS.logMetric(eventName, properties, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log(`[BrowserOSAdapter] Metric logged: ${eventName}`);
                resolve();
              }
            });
          } else {
            chrome.browserOS.logMetric(eventName, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log(`[BrowserOSAdapter] Metric logged: ${eventName}`);
                resolve();
              }
            });
          }
        } else {
          // If API not available, log a warning but don't fail
          console.warn(`[BrowserOSAdapter] logMetric API not available, skipping metric: ${eventName}`);
          resolve();
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BrowserOSAdapter] Failed to log metric: ${errorMessage}`);
      return;
    }
  }
}

// Export singleton instance getter for convenience
export const getBrowserOSAdapter = () => BrowserOSAdapter.getInstance();
