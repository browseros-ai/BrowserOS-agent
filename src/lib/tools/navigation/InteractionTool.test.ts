import { describe, it, expect, vi, beforeEach } from "vitest";
import { InteractionTool } from "./InteractionTool";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { EventBus, EventProcessor } from "@/lib/events";

describe("InteractionTool", () => {
  let executionContext: ExecutionContext;
  let browserContext: BrowserContext;
  let mockPage: any;
  let mockLLM: any;

  beforeEach(() => {
    // Setup mock browser context
    browserContext = new BrowserContext();

    // Setup mock page
    mockPage = {
      getElementByIndex: vi.fn(),
      clickElement: vi.fn(),
      inputText: vi.fn(),
      clearElement: vi.fn(),
      sendKeys: vi.fn(),
      isFileUploader: vi.fn().mockReturnValue(false),
    };

    // Setup mock LLM
    mockLLM = {
      invoke: vi.fn(),
      withStructuredOutput: vi.fn().mockReturnValue({
        invoke: vi.fn(),
      }),
    };

    // Setup execution context
    executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus()),
    });

    // Mock getCurrentPage
    vi.spyOn(browserContext, "getCurrentPage").mockResolvedValue(mockPage);

    // Mock getLLM
    vi.spyOn(executionContext, "getLLM").mockResolvedValue(mockLLM);
  });

  // Test 1: Tool creation
  it("tests that interaction tool can be created", () => {
    const tool = new InteractionTool(executionContext);
    expect(tool).toBeDefined();
  });

  // Test 2: Parameter validation
  it("tests that description parameter is required for operations", async () => {
    const tool = new InteractionTool(executionContext);

    // Test missing description for click
    let result = await tool.execute({ operationType: "click" });
    expect(result.ok).toBe(false);
    expect(result.output).toBe(
      "click operation requires description parameter",
    );

    // Test missing input_text for input_text operation
    result = await tool.execute({
      operationType: "input_text",
      description: "email field",
    });
    expect(result.ok).toBe(false);
    expect(result.output).toBe(
      "input_text operation requires description and input_text parameters",
    );

    // Test missing keys for send_keys
    result = await tool.execute({ operationType: "send_keys" });
    expect(result.ok).toBe(false);
    expect(result.output).toBe("send_keys operation requires keys parameter");
  });

  // Test 3: Successful click operation with element finding
  it("tests successful click operation when element is found", async () => {
    // Mock browser state with elements
    const mockBrowserState = {
      clickableElements: [{ nodeId: 123, name: "Submit", tag: "button" }],
      typeableElements: [],
      clickableElementsString:
        '[123] <C> <button> "Submit" ctx:"form" path:"form>button"',
      typeableElementsString: "",
    };
    vi.spyOn(browserContext, "getBrowserState").mockResolvedValue(
      mockBrowserState,
    );

    // Mock LLM response finding the element
    mockLLM.withStructuredOutput().invoke.mockResolvedValue({
      found: true,
      index: 123,
      confidence: "high",
      reasoning: "Found submit button",
    });

    // Mock element exists
    mockPage.getElementByIndex.mockResolvedValue({ nodeId: 123 });
    mockPage.clickElement.mockResolvedValue(undefined);

    const tool = new InteractionTool(executionContext);
    const result = await tool.execute({
      operationType: "click",
      description: "Submit button",
    });

    // Verify success without checking exact message
    expect(result.ok).toBe(true);
    expect(typeof result.output).toBe("string");
    expect(mockPage.clickElement).toHaveBeenCalledWith(123);
  });

  // Test 4: Handle element not found by LLM
  it("tests error handling when LLM cannot find element", async () => {
    // Mock browser state with elements
    const mockBrowserState = {
      clickableElements: [{ nodeId: 123, name: "Cancel", tag: "button" }],
      typeableElements: [],
      clickableElementsString:
        '[123] <C> <button> "Cancel" ctx:"form" path:"form>button"',
      typeableElementsString: "",
    };
    vi.spyOn(browserContext, "getBrowserState").mockResolvedValue(
      mockBrowserState,
    );

    // Mock LLM response - element not found
    mockLLM.withStructuredOutput().invoke.mockResolvedValue({
      found: false,
      index: null,
      confidence: null,
      reasoning: "No submit button found",
    });

    const tool = new InteractionTool(executionContext);
    const result = await tool.execute({
      operationType: "click",
      description: "Submit button",
    });

    // Just verify the operation failed - don't check specific error message
    expect(result.ok).toBe(false);
    expect(typeof result.output).toBe("string");
  });

  // Test 5: Handle no interactive elements on page
  it("tests error when no interactive elements exist", async () => {
    // Mock empty browser state
    const mockBrowserState = {
      clickableElements: [],
      typeableElements: [],
      clickableElementsString: "",
      typeableElementsString: "",
    };
    vi.spyOn(browserContext, "getBrowserState").mockResolvedValue(
      mockBrowserState,
    );

    const tool = new InteractionTool(executionContext);
    const result = await tool.execute({
      operationType: "click",
      description: "Any button",
    });

    // Just verify the operation failed
    expect(result.ok).toBe(false);
    expect(typeof result.output).toBe("string");
  });

  // Test 6: File upload detection
  it("tests that file upload elements are rejected", async () => {
    // Mock browser state
    const mockBrowserState = {
      clickableElements: [
        { nodeId: 456, name: "Choose File", tag: "input", type: "file" },
      ],
      typeableElements: [],
      clickableElementsString:
        '[456] <C> <input> "Choose File" attr:"type=file"',
      typeableElementsString: "",
    };
    vi.spyOn(browserContext, "getBrowserState").mockResolvedValue(
      mockBrowserState,
    );

    // Mock LLM finding the file input
    mockLLM.withStructuredOutput().invoke.mockResolvedValue({
      found: true,
      index: 456,
      confidence: "high",
      reasoning: "Found file input",
    });

    // Mock element is file uploader
    mockPage.getElementByIndex.mockResolvedValue({ nodeId: 456, type: "file" });
    mockPage.isFileUploader.mockReturnValue(true);

    const tool = new InteractionTool(executionContext);
    const result = await tool.execute({
      operationType: "click",
      description: "Choose file button",
    });

    // Just verify the operation failed for file upload
    expect(result.ok).toBe(false);
    expect(typeof result.output).toBe("string");
  });

  // Test 7: Successful input_text operation
  it("tests successful text input operation", async () => {
    // Mock browser state
    const mockBrowserState = {
      clickableElements: [],
      typeableElements: [
        { nodeId: 789, name: "", tag: "input", placeholder: "Enter email" },
      ],
      clickableElementsString: "",
      typeableElementsString:
        '[789] <T> <input> "" attr:"placeholder=Enter email"',
    };
    vi.spyOn(browserContext, "getBrowserState").mockResolvedValue(
      mockBrowserState,
    );

    // Mock LLM finding the input
    mockLLM.withStructuredOutput().invoke.mockResolvedValue({
      found: true,
      index: 789,
      confidence: "high",
      reasoning: "Found email input field",
    });

    // Mock element operations
    mockPage.getElementByIndex.mockResolvedValue({ nodeId: 789 });
    mockPage.clearElement.mockResolvedValue(undefined);
    mockPage.inputText.mockResolvedValue(undefined);

    const tool = new InteractionTool(executionContext);
    const result = await tool.execute({
      operationType: "input_text",
      description: "email field",
      input_text: "test@example.com",
    });

    // Verify success without checking exact message
    expect(result.ok).toBe(true);
    expect(typeof result.output).toBe("string");
    expect(mockPage.clearElement).toHaveBeenCalledWith(789);
    expect(mockPage.inputText).toHaveBeenCalledWith(789, "test@example.com");
  });

  // Test 8: Send keys operation (doesn't need element finding)
  it("tests send_keys operation works without element finding", async () => {
    mockPage.sendKeys.mockResolvedValue(undefined);

    const tool = new InteractionTool(executionContext);
    const result = await tool.execute({
      operationType: "send_keys",
      keys: "Enter",
    });

    expect(result.ok).toBe(true);
    expect(result.output).toBe("Sent keys: Enter");
    expect(mockPage.sendKeys).toHaveBeenCalledWith("Enter");
  });
});
