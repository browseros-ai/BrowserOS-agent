import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { MessageManager } from "@/lib/runtime/MessageManager";

export function makeStubExecutionContext(options: {
  browserState: string;
  messageHistory: string;
  useVision: boolean;
}): ExecutionContext {
  // Create minimal stubs for testing
  const stubBrowserContext = new BrowserContext();
  const stubMessageManager = new MessageManager();

  // Add the message history if provided
  if (options.messageHistory) {
    stubMessageManager.addHuman(options.messageHistory);
  }

  return new ExecutionContext({
    browserContext: stubBrowserContext,
    messageManager: stubMessageManager,
    abortSignal: new AbortController().signal,
  });
}
