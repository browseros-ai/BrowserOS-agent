import { describe, it, expect, vi, beforeEach } from "vitest";
import { NavigationTool } from "./NavigationTool";

// Mock BrowserPage
vi.mock("@/lib/browser/BrowserPage");

describe("NavigationTool", () => {
  let navigationTool: NavigationTool;
  let mockBrowserPage: any;
  let mockExecutionContext: any;

  beforeEach(() => {
    // Create mock browser page with all required methods
    mockBrowserPage = {
      navigateTo: vi.fn().mockResolvedValue(undefined),
      goBack: vi.fn().mockResolvedValue(undefined),
      goForward: vi.fn().mockResolvedValue(undefined),
      refreshPage: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://example.com"),
      title: vi.fn().mockResolvedValue("Example Page"),
    };

    // Create mock execution context
    mockExecutionContext = {
      browserContext: {
        getCurrentPage: vi.fn().mockResolvedValue(mockBrowserPage),
      },
    };

    navigationTool = new NavigationTool(mockExecutionContext);
  });

  it("tests that navigation to URL works with proper normalization", async () => {
    // Test 1: Navigate with full URL
    const result1 = await navigationTool.execute({
      action: "navigate",
      url: "https://example.com",
    });

    expect(result1.ok).toBe(true);
    expect(result1.output).toContain("Navigated to");
    expect(mockBrowserPage.navigateTo).toHaveBeenCalledWith(
      "https://example.com",
    );

    // Test 2: Navigate with domain only (should add https://)
    const result2 = await navigationTool.execute({
      action: "navigate",
      url: "example.com",
    });

    expect(result2.ok).toBe(true);
    expect(mockBrowserPage.navigateTo).toHaveBeenCalledWith(
      "https://example.com",
    );

    // Test 3: Navigate with search query (should use Google search)
    const result3 = await navigationTool.execute({
      action: "navigate",
      url: "how to test code",
    });

    expect(result3.ok).toBe(true);
    expect(mockBrowserPage.navigateTo).toHaveBeenCalledWith(
      "https://www.google.com/search?q=how%20to%20test%20code",
    );
  });

  it("tests that all navigation actions are handled correctly", async () => {
    // Test back navigation
    const backResult = await navigationTool.execute({ action: "back" });
    expect(backResult.ok).toBe(true);
    expect(backResult.output).toContain("Went back to");
    expect(mockBrowserPage.goBack).toHaveBeenCalled();

    // Test forward navigation
    const forwardResult = await navigationTool.execute({ action: "forward" });
    expect(forwardResult.ok).toBe(true);
    expect(forwardResult.output).toContain("Went forward to");
    expect(mockBrowserPage.goForward).toHaveBeenCalled();

    // Test refresh
    const refreshResult = await navigationTool.execute({ action: "refresh" });
    expect(refreshResult.ok).toBe(true);
    expect(refreshResult.output).toContain("Refreshed");
    expect(mockBrowserPage.refreshPage).toHaveBeenCalled();

    // Verify URL is required for navigate action
    const errorResult = await navigationTool.execute({ action: "navigate" });
    expect(errorResult.ok).toBe(false);
    expect(errorResult.output).toContain("URL is required");
  });
});
