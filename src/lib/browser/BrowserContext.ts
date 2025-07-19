import { z } from 'zod';
import BrowserPage from './BrowserPage';
import { Logging } from '../utils/Logging';
import { profileAsync } from '../utils/Profiler';

// ============= Browser Context Configuration =============

// Browser context window size schema
export const BrowserContextWindowSizeSchema = z.object({
  width: z.number().int().positive(),  // Window width in pixels
  height: z.number().int().positive()  // Window height in pixels
})

export type BrowserContextWindowSize = z.infer<typeof BrowserContextWindowSizeSchema>

// Browser context configuration schema
export const BrowserContextConfigSchema = z.object({
  maximumWaitPageLoadTime: z.number().default(5.0),  // Maximum time to wait for page load
  waitBetweenActions: z.number().default(0.1),  // Time to wait between multiple actions
  homePageUrl: z.string().default('https://www.google.com'),  // Home page url
  useVision: z.boolean().default(true)  // Use vision mode
})

export type BrowserContextConfig = z.infer<typeof BrowserContextConfigSchema>

// Default configuration
export const DEFAULT_BROWSER_CONTEXT_CONFIG: BrowserContextConfig = BrowserContextConfigSchema.parse({})

// Tab info schema
export const TabInfoSchema = z.object({
  id: z.number().int().positive(),  // Tab ID
  url: z.string(),  // Tab URL
  title: z.string()  // Tab title
})

export type TabInfo = z.infer<typeof TabInfoSchema>

// Browser state schema for V2
export const BrowserStateSchema = z.object({
  // Current tab info
  tabId: z.number(),  // Current tab ID
  url: z.string(),  // Current page URL
  title: z.string(),  // Current page title
  
  // All tabs info
  tabs: z.array(TabInfoSchema),  // All open tabs
  
  // Interactive elements as structured data
  clickableElements: z.array(z.object({
    nodeId: z.number(),  // Chrome BrowserOS node ID
    text: z.string(),  // Element text (axName or tag)
    tag: z.string()  // HTML tag name
  })),  // Clickable elements with nodeId, text, and tag
  
  typeableElements: z.array(z.object({
    nodeId: z.number(),  // Chrome BrowserOS node ID
    text: z.string(),  // Element text (axName or tag)
    tag: z.string()  // HTML tag name
  })),  // Typeable elements with nodeId, text, and tag
  
  // Pre-formatted strings for display
  clickableElementsString: z.string(),  // Formatted string of clickable elements
  typeableElementsString: z.string(),  // Formatted string of typeable elements
  
  // Hierarchical structure from BrowserOS API
  hierarchicalStructure: z.string().nullable().optional(),  // Hierarchical text representation with context
  
  // Screenshot support (base64 encoded)
  screenshot: z.string().nullable().optional()  // Base64 encoded screenshot data
})

export type BrowserState = z.infer<typeof BrowserStateSchema>

// Error classes
export class BrowserError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'BrowserError'
  }
}

export class URLNotAllowedError extends BrowserError {
  constructor(message?: string) {
    super(message)
    this.name = 'URLNotAllowedError'
  }
}

/**
 * Simplified BrowserContext that uses BrowserPageV2
 * 
 * Key differences from V1:
 * - No Puppeteer dependencies
 * - No tab attachment/detachment logic (pages are always "attached")
 * - Simplified state management
 * - Direct Chrome API usage
 */
export class BrowserContext {
  private _config: BrowserContextConfig;
  private _userSelectedTabIds: number[] | null = null;
  private _executionLockedTabId: number | null = null;
  
  // Simple page cache - no attachment state needed
  private _pageCache: Map<number, BrowserPage> = new Map();

  constructor(config: Partial<BrowserContextConfig> = {}) {
    this._config = { ...DEFAULT_BROWSER_CONTEXT_CONFIG, ...config };
  }

  public getConfig(): BrowserContextConfig {
    return this._config;
  }

  public updateConfig(config: Partial<BrowserContextConfig>): void {
    this._config = { ...this._config, ...config };
  }

  // ============= Core Page Operations =============

  /**
   * Get or create a Page instance for a tab
   */
  private async _getOrCreatePage(tab: chrome.tabs.Tab): Promise<BrowserPage> {
    if (!tab.id) {
      throw new Error('Tab ID is not available');
    }

    // Check cache
    const existingPage = this._pageCache.get(tab.id);
    if (existingPage) {
      return existingPage;
    }
    
    // Create new page
    const page = new BrowserPage(tab.id, tab.url || 'Unknown URL', tab.title || 'Unknown Title');
    this._pageCache.set(tab.id, page);
    
    Logging.log('BrowserContextV2', `Created page for tab ${tab.id}`);
    return page;
  }

  /**
   * Get the current page
   */
  public async getCurrentPage(): Promise<BrowserPage> {
    return profileAsync('BrowserContext.getCurrentPage', async () => {
    const targetTab = await this.getTargetTab();
    
    if (!targetTab.id) {
      throw new Error('Target tab has no ID');
    }

    const page = await this._getOrCreatePage(targetTab);
    
    // Set execution lock for single-tab operations
    if (!this._executionLockedTabId) {
      this.lockExecutionToTab(targetTab.id);
    }

    return page;
    });
  }

  // ============= Tab Management =============

  /**
   * Switch to a different tab
   */
  public async switchTab(tabId: number): Promise<BrowserPage> {
    return profileAsync(`BrowserContext.switchTab[${tabId}]`, async () => {
    Logging.log('BrowserContextV2', `Switching to tab ${tabId}`);

    await chrome.tabs.update(tabId, { active: true });
    const tab = await chrome.tabs.get(tabId);
    
    const page = await this._getOrCreatePage(tab);
    this._executionLockedTabId = tabId;
    
    return page;
    });
  }

  /**
   * Get tab information
   */
  public async getTabs(): Promise<TabInfo[]> {
    const tabs = await chrome.tabs.query({});
    const tabInfos: TabInfo[] = [];

    for (const tab of tabs) {
      if (tab.id && tab.url && tab.title) {
        tabInfos.push({
          id: tab.id,
          url: tab.url,
          title: tab.title,
        });
      }
    }
    return tabInfos;
  }

  // ============= Navigation Operations =============
  
  /**
   * Navigate to a URL
   */
  public async navigateTo(url: string): Promise<void> {
    const page = await this.getCurrentPage();
    await page.navigateTo(url);
  }
  
  /**
   * Open a new tab with URL
   */
  public async openTab(url: string): Promise<BrowserPage> {
    return profileAsync('BrowserContext.openTab', async () => {
    // Create the new tab
    const tab = await chrome.tabs.create({ url, active: true });
    if (!tab.id) {
      throw new Error('No tab ID available');
    }
    
    // Wait a bit for tab to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get updated tab information
    const updatedTab = await chrome.tabs.get(tab.id);
    const page = await this._getOrCreatePage(updatedTab);
    this._executionLockedTabId = tab.id;

    return page;
    });
  }
  
  /**
   * Close a tab
   */
  public async closeTab(tabId: number): Promise<void> {
    // Remove from cache
    this._pageCache.delete(tabId);
    
    // Close the tab
    await chrome.tabs.remove(tabId);
    
    // Update execution locked tab id if needed
    if (this._executionLockedTabId === tabId) {
      this._executionLockedTabId = null;
    }
    
    // Remove from user selected tabs if present
    if (this._userSelectedTabIds && this._userSelectedTabIds.includes(tabId)) {
      this._userSelectedTabIds = this._userSelectedTabIds.filter(id => id !== tabId);
    }
  }

  // ============= State Operations =============

  /**
   * Get detailed browser state description for agents
   */
  public async getBrowserStateString(): Promise<string> {
    return profileAsync('BrowserContext.getBrowserStateString', async () => {
    try {
      // Use the structured getBrowserState API
      const browserState = await this.getBrowserState();
      
      // Format current tab
      const currentTab = `{id: ${browserState.tabId}, url: ${browserState.url}, title: ${browserState.title}}`;
      
      // Format other tabs
      const otherTabs = browserState.tabs
        .filter(tab => tab.id !== browserState.tabId)
        .map(tab => `- {id: ${tab.id}, url: ${tab.url}, title: ${tab.title}}`);

      // Get current date/time
      const timeStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

      // Combine clickable and typeable elements

      let elementsText = '';
      const parts: string[] = [];
      if (browserState.clickableElementsString) {
        parts.push('Clickable elements:\n' + browserState.clickableElementsString);
      }
      if (browserState.typeableElementsString) {
        parts.push('Input fields:\n' + browserState.typeableElementsString);
      }
      elementsText = parts.join('\n\n') || 'No interactive elements found';


      // Include hierarchical structure if available
      // elementsText = browserState.hierarchicalStructure?  `\n\nHierarchical structure:\n${browserState.hierarchicalStructure}` : '';

      // Build state description
      const stateDescription = `
BROWSER STATE:
Current tab: ${currentTab}
Other available tabs:
  ${otherTabs.join('\n  ')}
Current date and time: ${timeStr}

Interactive elements from the current page (numbers in [brackets] are nodeIds):
${elementsText}
`;

      return stateDescription;
    } catch (error) {
      Logging.log('BrowserContextV2', `Failed to get detailed browser state: ${error}`, 'warning');
      const currentPage = await this.getCurrentPage();
      const url = await currentPage.url();
      const title = await currentPage.title();
      return `BROWSER STATE:\nCurrent page: ${url} - ${title}`;
    }
    });
  }

  // ============= Multi-Tab Operations =============

  /**
   * Get pages for specific tab IDs
   */
  public async getPages(tabIds?: number[]): Promise<BrowserPage[]> {
    try {
      // If no tab IDs provided, return current page
      if (!tabIds || tabIds.length === 0) {
        const currentPage = await this.getCurrentPage();
        return [currentPage];
      }

      // Get pages for specified tabs
      const pages: BrowserPage[] = [];
      
      for (const tabId of tabIds) {
        try {
          const tab = await chrome.tabs.get(tabId);
          const page = await this._getOrCreatePage(tab);
          pages.push(page);
        } catch (error) {
          Logging.log('BrowserContextV2', `Failed to get page for tab ${tabId}: ${error}`, 'warning');
        }
      }
      
      if (pages.length === 0) {
        throw new Error(`Failed to get any of the selected tabs (${tabIds.join(', ')})`);
      }
      
      return pages;
    } catch (error) {
      Logging.log('BrowserContextV2', `Error getting pages: ${error}`, 'error');
      return [];
    }
  }

  /**
   * Get all tab IDs from the current window
   */
  public async getAllTabIds(): Promise<Set<number>> {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return new Set(tabs.map(tab => tab.id).filter((id): id is number => id !== undefined));
    } catch (error) {
      Logging.log('BrowserContextV2', `Failed to get tab IDs: ${error}`, 'warning');
      return new Set();
    }
  }

  // ============= Execution Lock Management =============

  /**
   * Get the target tab for operations
   */
  private async getTargetTab(): Promise<chrome.tabs.Tab> {
    // Check if we're in a locked execution context
    if (this._executionLockedTabId) {
      try {
        const tab = await chrome.tabs.get(this._executionLockedTabId);
        if (tab) {
          return tab;
        }
      } catch (error) {
        Logging.log('BrowserContextV2', `Execution-locked tab ${this._executionLockedTabId} no longer exists`, 'warning');
        this._executionLockedTabId = null;
      }
    }
    
    // No locked tab - use the active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      throw new Error('No active tab available');
    }
    
    return activeTab;
  }

  /**
   * Lock execution to a specific tab
   */
  public lockExecutionToTab(tabId: number): void {
    this._executionLockedTabId = tabId;
    Logging.log('BrowserContextV2', `Execution locked to tab ${tabId}`);
  }
  
  /**
   * Unlock execution
   */
  public async unlockExecution(): Promise<void> {
    const previousLockedTab = this._executionLockedTabId;
    this._executionLockedTabId = null;
    Logging.log('BrowserContextV2', `Execution unlocked${previousLockedTab ? ` (was locked to tab ${previousLockedTab})` : ''}`);
  }

  // ============= Window Management =============

  public async getCurrentWindow(): Promise<chrome.windows.Window> {
    try {
      const tab = await this.getTargetTab();
      if (tab && tab.windowId) {
        const window = await chrome.windows.get(tab.windowId);
        return window;
      }
    } catch (error) {
      Logging.log('BrowserContextV2', `Failed to get window from target tab: ${error}`, 'warning');
    }
    
    // Fall back to current window
    const window = await chrome.windows.getCurrent();
    if (window) {
      return window;
    }

    throw new Error('No window found');
  }

  /**
   * Get structured browser state (V2 clean API)
   * @returns BrowserState object with current page info and interactive elements
   */
  public async getBrowserState(): Promise<BrowserState> {
    return profileAsync('BrowserContext.getBrowserState', async () => {
    try {
      const currentPage = await this.getCurrentPage();
      const tabs = await this.getTabs();
      
      // Get current page info
      const url = await currentPage.url();
      const title = await currentPage.title();
      const tabId = currentPage.tabId;

      // Get formatted strings from the page
      const clickableElementsString = await currentPage.getClickableElementsString();
      const typeableElementsString = await currentPage.getTypeableElementsString();
      
      // Get structured elements from the page
      const clickableElements = await currentPage.getClickableElements();
      const typeableElements = await currentPage.getTypeableElements();
      
      // Get hierarchical structure
      const hierarchicalStructure = await currentPage.getHierarchicalStructure();
      
      // Get screenshot if vision is enabled
      let screenshot: string | null = null;
      if (this._config.useVision) {
        screenshot = await currentPage.takeScreenshot();
      }
      
      // Build structured state
      const state: BrowserState = {
        // Current tab info
        tabId,
        url,
        title,
        
        // All tabs
        tabs,
        
        // Interactive elements
        clickableElements,
        typeableElements,
        
        // Pre-formatted strings
        clickableElementsString,
        typeableElementsString,
        
        // Hierarchical structure
        hierarchicalStructure,
        
        // Screenshot (if vision enabled)
        screenshot
      };
      
      return state;
    } catch (error) {
      Logging.log('BrowserContextV2', `Failed to get state: ${error}`, 'warning');
      
      // Return minimal state on error
      const minimalState: BrowserState = {
        tabId: 0,
        url: 'about:blank',
        title: 'New Tab',
        tabs: [],
        clickableElements: [],
        typeableElements: [],
        clickableElementsString: '',
        typeableElementsString: '',
        hierarchicalStructure: null,
        screenshot: null
      };
      
      return minimalState;
    }
    });
  }


  // ============= Cleanup Operations =============

  /**
   * Clean up all resources
   */
  public async cleanup(): Promise<void> {
    try {
      Logging.log('BrowserContextV2', 'Cleaning up browser context');
      
      // Clear all state
      this._pageCache.clear();
      this._executionLockedTabId = null;
      this._userSelectedTabIds = null;
      
      Logging.log('BrowserContextV2', 'Browser context cleaned up successfully');
    } catch (error) {
      Logging.log('BrowserContextV2', `Error during cleanup: ${error}`, 'error');
    }
  }
}

export default BrowserContext;
