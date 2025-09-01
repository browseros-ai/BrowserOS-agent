import { describe, it, expect, vi } from "vitest";
import { SearchTool } from "./SearchTool";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { EventBus, EventProcessor } from "@/lib/events";

describe("SearchTool", () => {
  // Unit Test 1: Tool creation
  it("tests that search tool can be created with required dependencies", () => {
    const executionContext = new ExecutionContext({
      browserContext: new BrowserContext(),
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus()),
    });

    const tool = new SearchTool(executionContext);
    expect(tool).toBeDefined();
  });

  // Unit Test 2: URL building
  it("tests that correct search URLs are built for each provider", async () => {
    const browserContext = new BrowserContext();
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus()),
    });

    // Mock page
    const mockPage = {
      navigateTo: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://example.com"),
    };
    vi.spyOn(browserContext, "getCurrentPage").mockResolvedValue(
      mockPage as any,
    );

    const tool = new SearchTool(executionContext);

    // Test Google search
    await tool.execute({ searchProvider: "google", query: "test query" });
    expect(mockPage.navigateTo).toHaveBeenCalledWith(
      "https://www.google.com/search?q=test%20query",
    );

    // Test Amazon search
    await tool.execute({ searchProvider: "amazon", query: "laptop" });
    expect(mockPage.navigateTo).toHaveBeenCalledWith(
      "https://www.amazon.com/s?k=laptop",
    );

    // Test Google Maps search
    await tool.execute({
      searchProvider: "google_maps",
      query: "coffee near me",
    });
    expect(mockPage.navigateTo).toHaveBeenCalledWith(
      "https://www.google.com/maps/search/coffee%20near%20me",
    );
  });

  // Unit Test 3: Successful search execution
  it("tests that search executes successfully", async () => {
    const browserContext = new BrowserContext();
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus()),
    });

    // Mock page
    const mockPage = {
      navigateTo: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://www.google.com/search?q=test"),
    };
    vi.spyOn(browserContext, "getCurrentPage").mockResolvedValue(
      mockPage as any,
    );

    const tool = new SearchTool(executionContext);
    const result = await tool.execute({
      searchProvider: "google",
      query: "test search",
    });

    expect(result.ok).toBe(true);
    expect(result.output).toBe('Searched for "test search" on google');
  });

  // Unit Test 4: Handle navigation errors
  it("tests that navigation errors are handled gracefully", async () => {
    const browserContext = new BrowserContext();
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus()),
    });

    // Mock page with navigation error
    const mockPage = {
      navigateTo: vi.fn().mockRejectedValue(new Error("Navigation failed")),
    };
    vi.spyOn(browserContext, "getCurrentPage").mockResolvedValue(
      mockPage as any,
    );

    const tool = new SearchTool(executionContext);
    const result = await tool.execute({
      searchProvider: "google",
      query: "test",
    });

    expect(result.ok).toBe(false);
    expect(result.output).toBe("Search failed: Navigation failed");
  });
});
