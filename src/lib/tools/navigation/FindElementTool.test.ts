import { describe, it, expect, vi } from "vitest";
import { FindElementTool } from "./FindElementTool";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { EventBus, EventProcessor } from "@/lib/events";

// ===================================================================
//  Unit Tests
// ===================================================================
describe("FindElementTool", () => {
  it("tests that find element tool can be created", () => {
    const messageManager = new MessageManager();
    const browserContext = new BrowserContext();
    const eventBus = new EventBus();
    const eventProcessor = new EventProcessor(eventBus);

    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      abortController: new AbortController(),
      debugMode: false,
      eventBus,
      eventProcessor,
    });

    const tool = new FindElementTool(executionContext);
    expect(tool).toBeDefined();
  });

  // Unit Test 2: Handle empty page
  it("tests that find element tool can handle page with no interactive elements", async () => {
    const browserContext = new BrowserContext();
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus()),
    });

    // Mock empty browser state
    vi.spyOn(browserContext, "getBrowserState").mockResolvedValue({
      tabId: 1,
      tabs: [{ id: 1, url: "https://example.com", title: "Test Page" }],
      clickableElements: [],
      typeableElements: [],
      clickableElementsString: "",
      typeableElementsString: "",
      url: "https://example.com",
      title: "Test Page",
      screenshot: null,
      hierarchicalStructure: null,
    });

    const tool = new FindElementTool(executionContext);
    const result = await tool.execute({
      elementDescription: "submit button",
    });

    expect(result.ok).toBe(false);
    expect(result.output).toBe(
      "No interactive elements found on the current page",
    );
  });

  // Unit Test 3: Handle LLM errors
  it("tests that find element tool can handle LLM invocation errors gracefully", async () => {
    const browserContext = new BrowserContext();
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus()),
    });

    // Mock browser state with elements
    vi.spyOn(browserContext, "getBrowserState").mockResolvedValue({
      tabId: 1,
      tabs: [{ id: 1, url: "https://example.com", title: "Test Page" }],
      clickableElements: [{ nodeId: 1, text: "Submit", tag: "button" }],
      typeableElements: [],
      clickableElementsString:
        '[1] <C> <button> "Submit" ctx:"Submit form" path:"form>button"',
      typeableElementsString: "",
      url: "https://example.com",
      title: "Test Page",
      screenshot: null,
      hierarchicalStructure: null,
    });

    // Mock LLM to throw error
    const mockLLM = {
      withStructuredOutput: vi.fn().mockReturnValue({
        invoke: vi.fn().mockRejectedValue(new Error("LLM failed")),
      }),
    };
    vi.spyOn(executionContext, "getLLM").mockResolvedValue(mockLLM as any);

    const tool = new FindElementTool(executionContext);
    const result = await tool.execute({
      elementDescription: "submit button",
    });

    expect(result.ok).toBe(false);
    expect(result.output).toContain("Failed to find element: LLM failed");
  });
});

// ===================================================================
//  Integration Tests
// ===================================================================
describe("FindElementTool-integration", () => {
  it.skipIf(
    !process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === "nokey",
  )(
    "tests that find element tool can find element using real LLM call",
    async () => {
      // Setup with real dependencies
      const browserContext = new BrowserContext();
      const messageManager = new MessageManager();
      const eventBus = new EventBus();
      const eventProcessor = new EventProcessor(eventBus);

      const executionContext = new ExecutionContext({
        browserContext,
        messageManager,
        abortController: new AbortController(),
        debugMode: false,
        eventBus,
        eventProcessor,
      });

      // Mock browser state with realistic elements
      vi.spyOn(browserContext, "getBrowserState").mockResolvedValue({
        tabId: 1,
        tabs: [{ id: 1, url: "https://example.com", title: "Test Page" }],
        clickableElements: [
          { nodeId: 1, text: "", tag: "a" },
          { nodeId: 2, text: "Submit", tag: "button" },
          { nodeId: 3, text: "", tag: "button" },
        ],
        typeableElements: [{ nodeId: 10, text: "", tag: "input" }],
        clickableElementsString:
          '[1] <C> <a> "Home" ctx:"Navigation" path:"nav>a"\n[2] <C> <button> "Submit" ctx:"Submit form" path:"form>button"\n[3] <C> <button> "Cancel" ctx:"Cancel action" path:"form>button"',
        typeableElementsString:
          '[10] <T> <input> "" ctx:"Email input" path:"form>input" attr:"type=email placeholder=Enter email"',
        url: "https://example.com",
        title: "Test Page",
        screenshot: null,
        hierarchicalStructure: null,
      });

      const tool = new FindElementTool(executionContext);

      // Test finding submit button
      const result = await tool.execute({
        elementDescription: "submit button",
      });

      // Verify result
      expect(result.ok).toBe(true);
      expect(result.output).toBeDefined();

      // Parse the JSON output
      const parsedOutput = JSON.parse(result.output);
      expect(parsedOutput.found).toBe(true);
      expect(parsedOutput.index).toBe(2);
      expect(parsedOutput.confidence).toBeDefined();
      expect(parsedOutput.reasoning).toBeDefined();
    },
    30000, // 30 second timeout for LLM call
  );
});
