// NOTE: We use LangChain's messages because they already keep track of token counts.
import {
  type BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { TokenCounter } from "@/lib/utils/TokenCounter";
import { Logging } from "@/lib/utils/Logging";

// Constants
export const TRIM_THRESHOLD = 0.9; // Start trimming at 90% capacity to maintain buffer

// Message type enum
export enum LLMMessageType {
  SYSTEM = "system",
  AI = "ai",
  HUMAN = "human",
  TOOL = "tool",
  BROWSER_STATE = "browser_state",
  TODO_LIST = "todo_list",
  SCREENSHOT = "screenshot",
}
export const MessageType = LLMMessageType;

// Create a new custom message type for browser state by extending LangChain's AIMessage.
// The langchain messages have messageType which can be set set to a custom value.
export class BrowserStateMessage extends AIMessage {
  constructor(content: string) {
    super(`<browser-state>${content}</browser-state>`);
    this.additional_kwargs = { messageType: LLMMessageType.BROWSER_STATE };
  }
}

// Custom message type for TODO list by extending LangChain's AIMessage
export class TodoListMessage extends AIMessage {
  constructor(content: string) {
    super(`<TodoList>${content}</TodoList>`);
    this.additional_kwargs = { messageType: LLMMessageType.TODO_LIST };
  }
}

// Custom message type for screenshots by extending LangChain's AIMessage
export class ScreenshotMessage extends AIMessage {
  constructor(content: string) {
    super(`<Screenshot>${content}</Screenshot>`);
    this.additional_kwargs = { messageType: LLMMessageType.SCREENSHOT };
  }
}

// Read-only view for tools
export class MessageManagerReadOnly {
  constructor(private messageManager: MessageManager) {}

  getAll(): BaseMessage[] {
    return this.messageManager.getMessages();
  }

  // Get messages filtered by excluding specific types
  getFiltered(excludeTypes: LLMMessageType[] = []): BaseMessage[] {
    if (excludeTypes.length === 0) {
      return this.getAll();
    }

    return this.getAll().filter((message) => {
      const messageType = this.messageManager._getMessageType(message);
      return !excludeTypes.includes(messageType);
    });
  }

  // Get filtered messages as formatted string (useful for history)
  getFilteredAsString(
    excludeTypes: LLMMessageType[] = [],
    separator: string = "\n",
  ): string {
    const messages = this.getFiltered(excludeTypes);
    return messages.map((m) => {
      const type = m._getType();
      const content = typeof m.content === "string" 
        ? m.content 
        : JSON.stringify(m.content);
      return `${type}: ${content}`;
    }).join(separator);
  }

  getRecentBrowserState(): string | null {
    const messages = this.messageManager.getMessages();
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i] instanceof BrowserStateMessage) {
        const content = messages[i].content;
        // Extract content from BrowserState tags if needed
        if (typeof content === "string" && content.includes("<browser-state>")) {
          return (
            content.match(/<browser-state>(.*?)<\/browser-state>/s)?.[1] ||
            content
          );
        }
        return content as string;
      }
    }
    return null;
  }
}

// Entry structure: message + cached token count
interface MessageEntry {
  message: BaseMessage; // The actual message
  tokens: number; // Cached token count for this message
}

export class MessageManager {
  private entries: MessageEntry[] = [];
  private totalTokens: number = 0;
  private maxTokens: number;
  private messageQueue: BaseMessage[] = []; // Queue for tool-generated messages

  constructor(maxTokens = 8192) {
    this.maxTokens = maxTokens;
  }

  // Centralized add method with message type handling
  add(message: BaseMessage, position?: number): void {
    const messageType = this._getMessageType(message);

    // Special handling (like removing existing messages) based on message type
    switch (messageType) {
      case LLMMessageType.SYSTEM:
        // Remove existing system messages first
        this.removeSystemMessages();
        break;

      case LLMMessageType.BROWSER_STATE:
        // Only one browser state at a time
        this.removeMessagesByType(LLMMessageType.BROWSER_STATE);
        break;

      case LLMMessageType.TODO_LIST:
        // Only one todo list at a time
        this.removeMessagesByType(LLMMessageType.TODO_LIST);
        break;

      case LLMMessageType.SCREENSHOT:
        // Only one screenshot at a time
        this.removeMessagesByType(LLMMessageType.SCREENSHOT);
        break;
    }

    // Calculate tokens once using TokenCounter utility
    const tokens = TokenCounter.countMessage(message);

    // this._ensureSpace(tokens); # No need to trim messages (as compation is already built in for planner while for executor, we dont need to trim)

    // Add entry at position or end
    const entry = { message, tokens };
    // If position is provided, insert at that position
    if (position !== undefined) {
      this.entries.splice(position, 0, entry);
    } else {
      this.entries.push(entry);
    }

    // Update total
    this.totalTokens += tokens;

    Logging.log(
      "MessageManager",
      `Total tokens in message manager: ${TokenCounter.format(this.totalTokens)}`,
      "info",
    );
  }

  addHuman(content: string): void {
    this.add(new HumanMessage(content));
  }

  addAI(content: string): void {
    this.add(new AIMessage(content));
  }

  addSystem(content: string, position: number = 0): void {
    this.add(new SystemMessage(content), position);
  }

  addBrowserState(content: string): void {
    this.add(new BrowserStateMessage(content));
  }

  addTodoList(content: string): void {
    this.add(new TodoListMessage(content));
  }

  addScreenshot(
    screenshotDataUrl: string,
    text: string = "Screenshot of current page state",
  ): void {
    // Add screenshot as multimodal HumanMessage with screenshot type marker
    const screenshotMessage = new HumanMessage({
      content: [
        {
          type: "image_url",
          image_url: {
            url: screenshotDataUrl,
          },
        },
        {
          type: "text",
          text: text,
        },
      ],
    });
    // Mark as screenshot type for removal handling
    screenshotMessage.additional_kwargs = {
      messageType: LLMMessageType.SCREENSHOT,
    };
    this.add(screenshotMessage);
  }

  addTool(content: string, toolCallId: string): void {
    this.add(new ToolMessage(content, toolCallId));
  }

  addSystemReminder(content: string): void {
    // For Anthropic, you can't have SystemMessage after first message
    // So we wrap it in an AIMessage
    this.add(new AIMessage(`<system-reminder>${content}</system-reminder>`));
  }

  // Get messages array
  getMessages(): BaseMessage[] {
    return this.entries.map((e) => e.message);
  }

  // Get current token count - O(1)
  getTokenCount(): number {
    return this.totalTokens;
  }

  // Get remaining tokens
  remaining(): number {
    return Math.max(0, this.maxTokens - this.getTokenCount());
  }

  // Get current max tokens limit
  getMaxTokens(): number {
    return this.maxTokens;
  }

  // Update max tokens limit and trim if needed
  setMaxTokens(newMaxTokens: number): void {
    const oldMaxTokens = this.maxTokens;
    this.maxTokens = newMaxTokens;

    // If new limit is lower, trim messages to fit
    if (newMaxTokens < oldMaxTokens) {
      // Remove messages until we fit within new limit
      while (this.totalTokens > this.maxTokens && this.entries.length > 0) {
        const removed = this._removeLowestPriority();
        if (!removed) break;
      }
    }
  }

  // Fork the message manager with optional history
  fork(includeHistory: boolean = true): MessageManager {
    const newMM = new MessageManager(this.maxTokens);
    if (includeHistory) {
      // Deep copy entries
      newMM.entries = this.entries.map((e) => ({
        message: e.message,
        tokens: e.tokens,
      }));
      newMM.totalTokens = this.totalTokens;
    }
    return newMM;
  }

  // Remove messages by type
  removeMessagesByType(type: LLMMessageType): void {
    // Filter out messages of the specified type and update tokens
    const newEntries: MessageEntry[] = [];
    let removedTokens = 0;

    for (const entry of this.entries) {
      if (this._getMessageType(entry.message) !== type) {
        newEntries.push(entry);
      } else {
        removedTokens += entry.tokens;
      }
    }

    this.entries = newEntries;
    this.totalTokens -= removedTokens;
  }

  removeSystemMessages(): void {
    this.removeMessagesByType(LLMMessageType.SYSTEM);
  }

  // Remove last message
  removeLast(): boolean {
    const removed = this.entries.pop();
    if (removed) {
      this.totalTokens -= removed.tokens;
      return true;
    }
    return false;
  }

  // Clear all messages but preserve maxTokens
  clear(): void {
    this.entries = [];
    this.totalTokens = 0;
  }

  // Queue API for tools to use during execution
  queueMessage(message: BaseMessage): void {
    this.messageQueue.push(message);
  }

  // Flush all queued messages to the main message list
  flushQueue(): void {
    for (const message of this.messageQueue) {
      this.add(message);
    }
    this.messageQueue = [];
  }

  // Clear queue without adding messages (for error cases)
  clearQueue(): void {
    this.messageQueue = [];
  }

  // Get current queue size
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  // Queue methods for tools - these queue messages instead of adding directly
  queueHuman(content: string): void {
    this.queueMessage(new HumanMessage(content));
  }

  queueScreenshot(
    screenshotDataUrl: string,
    text: string = "Screenshot of current page state",
  ): void {
    // Create screenshot as multimodal HumanMessage with screenshot type marker
    const screenshotMessage = new HumanMessage({
      content: [
        {
          type: "image_url",
          image_url: {
            url: screenshotDataUrl,
          },
        },
        {
          type: "text",
          text: text,
        },
      ],
    });
    // Mark as screenshot type for removal handling
    screenshotMessage.additional_kwargs = {
      messageType: LLMMessageType.SCREENSHOT,
    };
    this.queueMessage(screenshotMessage);
  }

  queueBrowserState(content: string): void {
    this.queueMessage(new BrowserStateMessage(content));
  }

  queueSystemReminder(content: string): void {
    // For Anthropic, can't have SystemMessage after first message
    this.queueMessage(
      new AIMessage(`<system-reminder>${content}</system-reminder>`),
    );
  }

  // Get message type (public for MessageManagerReadOnly access)
  _getMessageType(message: BaseMessage): LLMMessageType {
    // Check explicit message type first
    if (
      message.additional_kwargs?.messageType === LLMMessageType.BROWSER_STATE
    ) {
      return LLMMessageType.BROWSER_STATE;
    }
    if (message.additional_kwargs?.messageType === LLMMessageType.TODO_LIST) {
      return LLMMessageType.TODO_LIST;
    }
    if (message.additional_kwargs?.messageType === LLMMessageType.SCREENSHOT) {
      return LLMMessageType.SCREENSHOT;
    }
    
    // Check if ANY message contains image_url (multimodal screenshot)
    if (Array.isArray(message.content)) {
      const hasImage = message.content.some(
        (item: any) => item.type === "image_url" && item.image_url?.url
      );
      if (hasImage) {
        return LLMMessageType.SCREENSHOT;
      }
    }
    
    // Fall back to standard message type detection
    if (message instanceof HumanMessage) return LLMMessageType.HUMAN;
    if (message instanceof AIMessage) return LLMMessageType.AI;
    if (message instanceof SystemMessage) return LLMMessageType.SYSTEM;
    if (message instanceof ToolMessage) return LLMMessageType.TOOL;
    return LLMMessageType.AI;
  }

  // Calculate tokens for a single message
  private _getTokensForMessage(message: BaseMessage): number {
    // Delegate to TokenCounter utility
    return TokenCounter.countMessage(message);
  }

  // Ensure we have space for new tokens
  private _ensureSpace(needed: number): void {
    const threshold = this.maxTokens * TRIM_THRESHOLD; // Use configured trim threshold
    while (this.totalTokens + needed > threshold && this.entries.length > 0) {
      const removed = this._removeLowestPriority();
      if (!removed) break; // Nothing left to remove
    }
  }

  // Remove lowest priority message
  private _removeLowestPriority(): boolean {
    // Priority tiers (lower number = remove first)
    // AI < TOOL < HUMAN < BROWSER_STATE < SCREENSHOT < TODO_LIST < SYSTEM
    const priorities: Record<LLMMessageType, number> = {
      [LLMMessageType.AI]: 0,
      [LLMMessageType.TOOL]: 1,
      [LLMMessageType.HUMAN]: 2,
      [LLMMessageType.BROWSER_STATE]: 3,
      [LLMMessageType.SCREENSHOT]: 4, // High priority - keep screenshot context
      [LLMMessageType.TODO_LIST]: 5, // High priority - keep unless necessary
      [LLMMessageType.SYSTEM]: 6,
    };

    // Keep last 3 messages for context continuity
    const keepRecent = 3;
    const removableCount = Math.max(0, this.entries.length - keepRecent);

    if (removableCount === 0) return false;

    // Find lowest priority message in removable range
    let lowestIdx = -1;
    let lowestPriority = Infinity;

    for (let i = 0; i < removableCount; i++) {
      const type = this._getMessageType(this.entries[i].message);
      const priority = priorities[type] ?? 1;

      if (priority < lowestPriority) {
        lowestPriority = priority;
        lowestIdx = i;
      }
    }

    if (lowestIdx === -1) return false;

    // Remove the message and update total
    const removed = this.entries.splice(lowestIdx, 1)[0];
    this.totalTokens -= removed.tokens;
    return true;
  }
}
