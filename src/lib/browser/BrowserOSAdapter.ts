import { Logging } from '@/lib/utils/Logging';
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
      Logging.log('BrowserOSAdapter', `Getting interactive snapshot for tab ${tabId} with options: ${JSON.stringify(options)}`, 'info');
      
      return new Promise<InteractiveSnapshot>((resolve, reject) => {
        if (options) {
          chrome.browserOS.getInteractiveSnapshot(
            tabId,
            options,
            (snapshot: InteractiveSnapshot) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                Logging.log('BrowserOSAdapter', `Retrieved snapshot with ${snapshot.elements.length} elements`, 'info');
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
                Logging.log('BrowserOSAdapter', `Retrieved snapshot with ${snapshot.elements.length} elements`, 'info');
                resolve(snapshot);
              }
            }
          );
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('BrowserOSAdapter', `Failed to get interactive snapshot: ${errorMessage}`, 'error');
      throw new Error(`Failed to get interactive snapshot: ${errorMessage}`);
    }
  }

  /**
   * Click an element by node ID
   */
  async click(tabId: number, nodeId: number): Promise<void> {
    try {
      Logging.log('BrowserOSAdapter', `Clicking node ${nodeId} in tab ${tabId}`, 'info');
      
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
      Logging.log('BrowserOSAdapter', `Failed to click node: ${errorMessage}`, 'error');
      throw new Error(`Failed to click node ${nodeId}: ${errorMessage}`);
    }
  }

  /**
   * Input text into an element
   */
  async inputText(tabId: number, nodeId: number, text: string): Promise<void> {
    try {
      Logging.log('BrowserOSAdapter', `Inputting text into node ${nodeId} in tab ${tabId}`, 'info');
      
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
      Logging.log('BrowserOSAdapter', `Failed to input text: ${errorMessage}`, 'error');
      throw new Error(`Failed to input text into node ${nodeId}: ${errorMessage}`);
    }
  }

  /**
   * Clear text from an element
   */
  async clear(tabId: number, nodeId: number): Promise<void> {
    try {
      Logging.log('BrowserOSAdapter', `Clearing node ${nodeId} in tab ${tabId}`, 'info');
      
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
      Logging.log('BrowserOSAdapter', `Failed to clear node: ${errorMessage}`, 'error');
      throw new Error(`Failed to clear node ${nodeId}: ${errorMessage}`);
    }
  }

  /**
   * Scroll to a specific node
   */
  async scrollToNode(tabId: number, nodeId: number): Promise<boolean> {
    try {
      Logging.log('BrowserOSAdapter', `Scrolling to node ${nodeId} in tab ${tabId}`, 'info');
      
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
      Logging.log('BrowserOSAdapter', `Failed to scroll to node: ${errorMessage}`, 'error');
      throw new Error(`Failed to scroll to node ${nodeId}: ${errorMessage}`);
    }
  }

  /**
   * Send keyboard keys
   */
  async sendKeys(tabId: number, keys: chrome.browserOS.Key): Promise<void> {
    try {
      Logging.log('BrowserOSAdapter', `Sending keys "${keys}" to tab ${tabId}`, 'info');
      
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
      Logging.log('BrowserOSAdapter', `Failed to send keys: ${errorMessage}`, 'error');
      throw new Error(`Failed to send keys: ${errorMessage}`);
    }
  }

  /**
   * Get page load status
   */
  async getPageLoadStatus(tabId: number): Promise<PageLoadStatus> {
    try {
      Logging.log('BrowserOSAdapter', `Getting page load status for tab ${tabId}`, 'info');
      
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
      Logging.log('BrowserOSAdapter', `Failed to get page load status: ${errorMessage}`, 'error');
      throw new Error(`Failed to get page load status: ${errorMessage}`);
    }
  }

  /**
   * Get accessibility tree (if available)
   */
  async getAccessibilityTree(tabId: number): Promise<chrome.browserOS.AccessibilityTree> {
    try {
      Logging.log('BrowserOSAdapter', `Getting accessibility tree for tab ${tabId}`, 'info');
      
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
      Logging.log('BrowserOSAdapter', `Failed to get accessibility tree: ${errorMessage}`, 'error');
      throw new Error(`Failed to get accessibility tree: ${errorMessage}`);
    }
  }

  /**
   * Capture a screenshot of the tab
   */
  async captureScreenshot(tabId: number): Promise<string> {
    try {
      Logging.log('BrowserOSAdapter', `Capturing screenshot for tab ${tabId}`, 'info');
      
      return new Promise<string>((resolve, reject) => {
        chrome.browserOS.captureScreenshot(tabId, (dataUrl: string) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            Logging.log('BrowserOSAdapter', `Screenshot captured for tab ${tabId}`, 'info');
            resolve(dataUrl);
          }
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('BrowserOSAdapter', `Failed to capture screenshot: ${errorMessage}`, 'error');
      throw new Error(`Failed to capture screenshot: ${errorMessage}`);
    }
  }

  /**
   * Get a content snapshot of the specified type from the page
   */
  async getSnapshot(tabId: number, type: SnapshotType, options?: SnapshotOptions): Promise<Snapshot> {
    try {
      Logging.log('BrowserOSAdapter', `Getting ${type} snapshot for tab ${tabId} with options: ${JSON.stringify(options)}`, 'info');
      
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
                Logging.log('BrowserOSAdapter', `Retrieved ${type} snapshot with ${snapshot.sections.length} sections`, 'info');
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
                Logging.log('BrowserOSAdapter', `Retrieved ${type} snapshot with ${snapshot.sections.length} sections`, 'info');
                resolve(snapshot);
              }
            }
          );
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('BrowserOSAdapter', `Failed to get ${type} snapshot: ${errorMessage}`, 'error');
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
      Logging.log('BrowserOSAdapter', `Invoking BrowserOS API: ${method}`, 'info');
      
      if (!(method in chrome.browserOS)) {
        throw new Error(`Unknown BrowserOS API method: ${method}`);
      }
      
      // @ts-expect-error - Dynamic API invocation
      const result = await chrome.browserOS[method](...args);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('BrowserOSAdapter', `Failed to invoke API ${method}: ${errorMessage}`, 'error');
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
      Logging.log('BrowserOSAdapter', 'Getting BrowserOS version', 'info');
      
      return new Promise<string | null>((resolve, reject) => {
        // Check if getVersionNumber API is available
        if ('getVersionNumber' in chrome.browserOS && typeof chrome.browserOS.getVersionNumber === 'function') {
          chrome.browserOS.getVersionNumber((version: string) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              Logging.log('BrowserOSAdapter', `BrowserOS version: ${version}`, 'info');
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
      Logging.log('BrowserOSAdapter', `Failed to get version: ${errorMessage}`, 'error');
      // Return null on error
      return null;
    }
  }

  /**
   * Log a metric event with optional properties
   */
  async logMetric(eventName: string, properties?: Record<string, any>): Promise<void> {
    try {
      Logging.log('BrowserOSAdapter', `Logging metric: ${eventName} with properties: ${JSON.stringify(properties)}`, 'info');
      
      return new Promise<void>((resolve, reject) => {
        // Check if logMetric API is available
        if ('logMetric' in chrome.browserOS && typeof chrome.browserOS.logMetric === 'function') {
          if (properties) {
            chrome.browserOS.logMetric(eventName, properties, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                Logging.log('BrowserOSAdapter', `Metric logged: ${eventName}`, 'info');
                resolve();
              }
            });
          } else {
            chrome.browserOS.logMetric(eventName, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                Logging.log('BrowserOSAdapter', `Metric logged: ${eventName}`, 'info');
                resolve();
              }
            });
          }
        } else {
          // If API not available, log a warning but don't fail
          Logging.log('BrowserOSAdapter', `logMetric API not available, skipping metric: ${eventName}`, 'warning');
          resolve();
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('BrowserOSAdapter', `Failed to log metric: ${errorMessage}`, 'error');
      return;
    }
  }
}

// Export singleton instance getter for convenience
export const getBrowserOSAdapter = () => BrowserOSAdapter.getInstance();
