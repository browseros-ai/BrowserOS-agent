import { Logging } from "@/lib/utils/Logging";

const NAVIGATION_DELAY_MS = 100; // Delay after navigation before re-injection

/**
 * Service to manage glow animation overlay on browser tabs
 * Provides visual feedback during agent execution
 */
export class GlowAnimationService {
  private static instance: GlowAnimationService;
  private activeGlows: Set<number> = new Set();
  private navigationListener:
    | ((
        details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
      ) => void)
    | null = null;

  private constructor() {
    this._setupNavigationListener();
  }

  static getInstance(): GlowAnimationService {
    if (!GlowAnimationService.instance) {
      GlowAnimationService.instance = new GlowAnimationService();
    }
    return GlowAnimationService.instance;
  }

  /**
   * Start glow animation on a specific tab
   */
  async startGlow(tabId: number): Promise<void> {
    try {
      if (this.activeGlows.has(tabId)) {
        Logging.log(
          "GlowAnimationService",
          `Glow already active on tab ${tabId}`,
        );
        return;
      }

      // Check if tab exists
      try {
        await chrome.tabs.get(tabId);
      } catch (error) {
        Logging.log(
          "GlowAnimationService",
          `Tab ${tabId} not found`,
          "warning",
        );
        return;
      }

      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["glow-animation.js"],
      });

      // Send start message
      await chrome.tabs.sendMessage(tabId, {
        action: "startGlow",
        source: "GlowAnimationService",
      });

      this.activeGlows.add(tabId);
      Logging.log("GlowAnimationService", `Started glow on tab ${tabId}`);
    } catch (error) {
      Logging.log(
        "GlowAnimationService",
        `Failed to start glow on tab ${tabId}: ${error}`,
        "error",
      );
    }
  }

  /**
   * Stop glow animation on a specific tab
   */
  async stopGlow(tabId: number): Promise<void> {
    try {
      if (!this.activeGlows.has(tabId)) {
        return;
      }

      // Send stop message
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: "stopGlow",
          source: "GlowAnimationService",
        });
      } catch (error) {
        // Tab might be closed or navigated away
        Logging.log(
          "GlowAnimationService",
          `Failed to send stop message to tab ${tabId}: ${error}`,
          "warning",
        );
      }

      this.activeGlows.delete(tabId);
      Logging.log("GlowAnimationService", `Stopped glow on tab ${tabId}`);
    } catch (error) {
      Logging.log(
        "GlowAnimationService",
        `Failed to stop glow on tab ${tabId}: ${error}`,
        "error",
      );
    }
  }

  /**
   * Stop all active glow animations
   */
  async stopAllGlows(): Promise<void> {
    const tabIds = Array.from(this.activeGlows);
    await Promise.all(tabIds.map((tabId) => this.stopGlow(tabId)));
  }

  /**
   * Check if glow is active on a tab
   */
  isGlowActive(tabId: number): boolean {
    return this.activeGlows.has(tabId);
  }

  /**
   * Get all active glow tab IDs
   */
  getAllActiveGlows(): Set<number> {
    return new Set(this.activeGlows);
  }

  /**
   * Clean up glow for closed tabs
   */
  handleTabClosed(tabId: number): void {
    if (this.activeGlows.has(tabId)) {
      this.activeGlows.delete(tabId);
      Logging.log(
        "GlowAnimationService",
        `Cleaned up glow for closed tab ${tabId}`,
      );
    }
  }

  /**
   * Setup navigation listener to re-inject glow on URL changes
   */
  private _setupNavigationListener(): void {
    this.navigationListener = (
      details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
    ) => {
      // Only handle committed navigations in the main frame
      if (details.frameId !== 0) return;

      // Check if this tab has an active glow
      if (this.activeGlows.has(details.tabId)) {
        Logging.log(
          "GlowAnimationService",
          `Navigation detected for tab ${details.tabId} with active glow, re-injecting...`,
        );

        // Wait a bit for the page to load before re-injecting
        setTimeout(() => {
          this._reinjectGlow(details.tabId);
        }, NAVIGATION_DELAY_MS);
      }
    };

    // Listen for navigation commits (when a new page starts loading)
    chrome.webNavigation.onCommitted.addListener(this.navigationListener);
  }

  /**
   * Re-inject glow content script after navigation
   */
  private async _reinjectGlow(tabId: number): Promise<void> {
    try {
      // Check if tab still exists and glow is still active
      if (!this.activeGlows.has(tabId)) {
        return;
      }

      // Check if tab exists
      try {
        await chrome.tabs.get(tabId);
      } catch (error) {
        this.activeGlows.delete(tabId);
        return;
      }

      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["glow-animation.js"],
      });

      // Send start message
      await chrome.tabs.sendMessage(tabId, {
        action: "startGlow",
        source: "GlowAnimationService",
      });

      Logging.log(
        "GlowAnimationService",
        `Re-injected glow on tab ${tabId} after navigation`,
      );
    } catch (error) {
      Logging.log(
        "GlowAnimationService",
        `Failed to re-inject glow on tab ${tabId}: ${error}`,
        "warning",
      );
    }
  }

  /**
   * Cleanup method to remove listeners
   */
  cleanup(): void {
    if (this.navigationListener) {
      chrome.webNavigation.onCommitted.removeListener(this.navigationListener);
      this.navigationListener = null;
    }
    this.activeGlows.clear();
  }
}
