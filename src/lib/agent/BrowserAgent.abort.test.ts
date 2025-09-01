import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserAgent } from "./BrowserAgent";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { AbortError } from "@/lib/utils/Abortable";

// Mock Chrome API
global.chrome = {
  webNavigation: {
    onCommitted: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
} as any;

describe("BrowserAgent Abort Mechanism", () => {
  let browserAgent: BrowserAgent;
  let mockExecutionContext: ExecutionContext;
  let abortController: AbortController;

  beforeEach(() => {
    abortController = new AbortController();

    // Mock ExecutionContext with abort functionality
    mockExecutionContext = {
      abortController,
      isUserCancellation: () => false,
      checkIfAborted: function () {
        if (this.abortController.signal.aborted) {
          throw new AbortError("Task cancelled");
        }
      },
    } as any;

    browserAgent = new BrowserAgent(mockExecutionContext);
  });

  it("tests that checkIfAborted throws when abort signal is triggered", () => {
    // Initially should not throw
    expect(() => browserAgent["checkIfAborted"]()).not.toThrow();

    // Trigger abort
    abortController.abort();

    // Now should throw AbortError
    expect(() => browserAgent["checkIfAborted"]()).toThrow(AbortError);
  });

  it("tests that abort mechanism stops execution", () => {
    // The checkIfAborted method is called in:
    // 1. Streaming loop (for each chunk)
    // 2. Before and after each tool execution
    // 3. In strategy loops

    // This ensures execution stops quickly when abort is triggered
    expect(browserAgent["checkIfAborted"]).toBeDefined();

    // Verify the method is bound to execution context
    const checkMethod = browserAgent["checkIfAborted"].bind(browserAgent);

    // Should not throw initially
    expect(() => checkMethod()).not.toThrow();

    // After abort, should throw
    abortController.abort();
    expect(() => checkMethod()).toThrow(AbortError);
  });
});
