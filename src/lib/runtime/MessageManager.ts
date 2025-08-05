// NOTE: We use LangChain's messages because they already keep track of token counts.
import {
  type BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";

// Message type enum
export enum MessageType {
  SYSTEM = 'system',
  AI = 'ai', 
  HUMAN = 'human',
  TOOL = 'tool',
  BROWSER_STATE = 'browser_state'
}

// Constants for token approximation
const CHARS_PER_TOKEN = 4;
const TOKENS_PER_MESSAGE = 3;

// Create a new custom message type for browser state by extending LangChain's AIMessage.
// The langchain messages have messageType which can be set set to a custom value.
export class BrowserStateMessage extends AIMessage {
  constructor(content: string) {
    super(`<system-reminder>${content}</system-reminder>`);
    this.additional_kwargs = { messageType: MessageType.BROWSER_STATE };
  }
}


// Read-only view for tools
export class MessageManagerReadOnly {
  constructor(private messageManager: MessageManager) {}

  getAll(): BaseMessage[] {
    return this.messageManager.getMessages();
  }

  getRecentBrowserState(): string | null {
    const messages = this.messageManager.getMessages();
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i] instanceof BrowserStateMessage) {
        return messages[i].content as string;
      }
    }
    return null;
  }
}

export class MessageManager {
  private messages: BaseMessage[] = [];
  private maxTokens: number;
  
  constructor(maxTokens = 8192) {
    this.maxTokens = maxTokens;
  }

  // Add message and auto-trim if needed
  add(message: BaseMessage): void {
    this.messages.push(message);
    this._trimIfNeeded();
  }

  // Convenience methods
  addHuman(content: string): void {
    this.add(new HumanMessage(content));
    this._trimIfNeeded();
  }

  addAI(content: string): void {
    this.add(new AIMessage(content));
    this._trimIfNeeded();
  }

  addSystem(content: string, position?: number): void {
    this.removeSystemMessages();
    this.messages.splice(position ?? this.messages.length, 0, new SystemMessage(content));
    this._trimIfNeeded();
  }

  addBrowserState(content: string): void {
    // Remove existing browser state messages before adding new one
    this.removeMessagesByType(MessageType.BROWSER_STATE);
    this.add(new BrowserStateMessage(content));
    this._trimIfNeeded();
  }


  addTool(content: string, toolCallId: string): void {
    this.add(new ToolMessage(content, toolCallId));
    this._trimIfNeeded();
  }

  addSystemReminder(content: string): void {
    // Add system message with system-reminder tags
    // For Anthropic, you can't have SystemMessage after first message
    this.add(new HumanMessage(`<system-reminder>${content}</system-reminder>`));
    this._trimIfNeeded();
  }

  // Get messages
  getMessages(): BaseMessage[] {
    return [...this.messages];
  }

  // Get message type
  private _getMessageType(message: BaseMessage): MessageType {
    if (message.additional_kwargs?.messageType === MessageType.BROWSER_STATE) {
      return MessageType.BROWSER_STATE;
    }
    if (message instanceof HumanMessage) return MessageType.HUMAN;
    if (message instanceof AIMessage) return MessageType.AI;
    if (message instanceof SystemMessage) return MessageType.SYSTEM;
    if (message instanceof ToolMessage) return MessageType.TOOL;
    return MessageType.AI;
  }

  // Remove messages by type
  removeMessagesByType(type: MessageType): void {
    this.messages = this.messages.filter(msg => this._getMessageType(msg) !== type);
  }

  // Get current token count - simple approximation
  getTokenCount(): number {
    if (this.messages.length === 0) return 0;
    
    let totalTokens = 0;
    
    for (const msg of this.messages) {
      // Add per-message overhead
      totalTokens += TOKENS_PER_MESSAGE;
      
      // Count content tokens
      if (typeof msg.content === 'string') {
        totalTokens += Math.ceil(msg.content.length / CHARS_PER_TOKEN);
      } else if (msg.content) {
        // For complex content (arrays, objects), stringify and count
        const contentStr = JSON.stringify(msg.content);
        totalTokens += Math.ceil(contentStr.length / CHARS_PER_TOKEN);
      }
      
      // Count additional fields for AI messages (tool calls)
      if (msg instanceof AIMessage && msg.tool_calls) {
        const toolCallsStr = JSON.stringify(msg.tool_calls);
        totalTokens += Math.ceil(toolCallsStr.length / CHARS_PER_TOKEN);
      }
      
      // Count tool message IDs
      if (msg instanceof ToolMessage && msg.tool_call_id) {
        totalTokens += Math.ceil(msg.tool_call_id.length / CHARS_PER_TOKEN);
      }
    }
    
    return totalTokens;
  }

  // Get remaining tokens
  remaining(): number {
    return Math.max(0, this.maxTokens - this.getTokenCount());
  }

  // Clear all
  clear(): void {
    this.messages = [];
  }

  // Remove last message
  removeLast(): boolean {
    return this.messages.pop() !== undefined;
  }

  removeSystemMessages(): void {
    this.removeMessagesByType(MessageType.SYSTEM);
  }

  // Fork the message manager with optional history
  fork(includeHistory: boolean = true): MessageManager {
    const newMM = new MessageManager(this.maxTokens);
    if (includeHistory) {
      newMM.messages = [...this.messages];
    }
    return newMM;
  }

  // Private: Auto-trim to fit token budget
  private _trimIfNeeded(): void {
    // Simple trimming by removing oldest non-system and non-browser-state messages
    while (this.getTokenCount() > this.maxTokens && this.messages.length > 1) {
      const indexToRemove = this.messages.findIndex(msg => {
        const type = this._getMessageType(msg);
        return type !== MessageType.SYSTEM;
      });
      
      if (indexToRemove !== -1) {
        this.messages.splice(indexToRemove, 1);
      } else {
        // All remaining messages are system/browser state messages, remove the oldest one
        this.messages.shift();
      }
    }
  }
}
