import { type BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { Logging } from '@/lib/utils/Logging';
// import { wrapUserRequest } from '../utils/MessageUtils';

// Simple wrapper function to replace the missing import
function wrapUserRequest(content: string): string {
  return content; // For now, just return the content as-is
}

export const MessageTypeEnum = z.enum(["human", "ai", "system", "tool", "plan", "generic", "task", "browser_state", "validation_feedback", "productivity_task", "productivity_human", "productivity_ai"]);
export type MessageType = z.infer<typeof MessageTypeEnum>;

// Define schemas using Zod
export const MessageMetadataSchema = z.object({
  tokens: z.number(),  // Token count for this message
  messageType: MessageTypeEnum.optional(),
  timestamp: z.date().optional(),  // When message was added
});

export const MessageManagerSettingsSchema = z.object({
  maxInputTokens: z.number().default(128000),  // Maximum input tokens allowed
  estimatedCharactersPerToken: z.number().default(3),  // Characters per token estimate
  imageTokens: z.number().default(800),  // Token cost per image
  includeAttributes: z.array(z.string()).default([]),  // Attributes to include
  messageContext: z.string().optional(),  // Context for messages
  sensitiveData: z.record(z.string(), z.string()).optional(),  // Sensitive data placeholders
  availableFilePaths: z.array(z.string()).optional(),  // Available file paths
});


// Infer types from schemas
export type MessageMetadata = z.infer<typeof MessageMetadataSchema>;
export type MessageManagerSettings = z.infer<typeof MessageManagerSettingsSchema>;

// Internal message wrapper
interface TrackedMessage {
  // BaseMessage.getType() = "human" | "ai" | "generic" | "developer" | "system" | "function" | "tool" | "remove";
  message: BaseMessage;  // The actual LangChain message
  metadata: MessageMetadata;  // Associated metadata
}

export default class MessageManager {
  private messages: TrackedMessage[] = [];
  private totalTokens = 0;
  private toolId = 1;
  private settings: MessageManagerSettings;
  private previousTaskType: 'productivity' | 'browse' | 'answer' | null = null;  // Track previous task type

  constructor(settings: Partial<MessageManagerSettings> = {}) {
    this.settings = MessageManagerSettingsSchema.parse(settings);
  }

  public add(message: BaseMessage, messageType?: MessageType, position?: number): void {
    const tokens = this.countTokens(message);
    if (messageType === undefined) {
      messageType = this.getMessageTypeFromBase(message);
    }
    
    const metadata: MessageMetadata = {
      tokens,
      messageType: messageType,
      timestamp: new Date(),
    };

    const trackedMessage: TrackedMessage = { message, metadata };

    if (position === undefined) {
      this.messages.push(trackedMessage);
    } else {
      this.messages.splice(position, 0, trackedMessage);
    }
    
    // take care of trimming to fit
    if (this.isOverBudget()) {
      Logging.log('MessageManager', `Over budget - trimming to fit - total tokens: ${this.totalTokens}/${this.settings.maxInputTokens}`, 'warning');
      this.trimToFit();
    }

    this.totalTokens += tokens;
  }

  public addTaskMessage(task: string): void {
    const content = `Your ultimate task is: """${task}""". If you achieved your ultimate task, stop everything and use the done action in the next step to complete the task. If not, continue as usual.`;
    const wrappedContent = wrapUserRequest(content);
    const msg = new HumanMessage({ content: wrappedContent });
    this.add(msg, 'task');
  }

  public addFollowUpTaskMessage(task: string): void {
    const content = `Your NEW ultimate task is: """${task}""". This is a FOLLOW UP of the previous tasks. Make sure to take all of the previous context into account and finish your new ultimate task.`;
    const wrappedContent = wrapUserRequest(content);
    const msg = new HumanMessage({ content: wrappedContent });
    this.add(msg, 'task');
  }
  
  public addHumanMessage(content: string, position?: number): void {
    const msg = new HumanMessage({ content });
    this.add(msg, 'human', position);
  }
  
  public addSystemMessage(content: string, position?: number): void {
    // Remove any existing system messages first to ensure only one system prompt is active
    this.removeSystemMessage();
    
    // Now add the new system message
    const msg = new SystemMessage({ content });
    this.add(msg, 'system', position);
  }
  
  public removeSystemMessage(): void {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].metadata.messageType === 'system') {
        this.remove(i);
      }
    }
  }
  
  public addAIMessage(content: string, position?: number): void {
    const msg = new AIMessage({ content });
    this.add(msg, 'ai', position);
  }
  
  public removeAIMessage(): void {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].metadata.messageType === 'ai') {
        this.remove(i);
      }
    }
  }

  public addToolMessage(result: string, toolName: string): void {
    // We won't use ToolMessage type because it requires specific format.
    // all we need is the this for our tracking ONLY. So we'll use AIMessage instead.
    
    // const toolMessage = new ToolMessage({
    //   content: result,
    //   name: toolName,
    //   tool_call_id: toolName,
    // });
    const message =  {
      tool_name: toolName,
      result: result,
    }
    const msg = new AIMessage(JSON.stringify(message));
    this.add(msg, 'tool');
  }

  public addPlanMessage(plan: string | string[], position?: number): void {
    let content: string;
    if (Array.isArray(plan)) {
      // Format array of steps as JSON for easy parsing
      content = `<plan>${JSON.stringify(plan)}</plan>`;
    } else {
      // Keep string format for backward compatibility
      content = `<plan>${plan}</plan>`;
    }
    
    const msg = new AIMessage({ content });
    this.add(msg, 'plan', position);
    
    Logging.log('MessageManager', `Added plan with ${Array.isArray(plan) ? plan.length + ' steps' : 'custom format'}`, 'info');
  }

  /**
   * Get the previous plan message content
   * @returns Array of plan steps or undefined
   */
  public getPreviousPlan(): string[] | undefined {
    // Find the last plan message
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].metadata.messageType === 'plan') {
        const content = this.messages[i].message.content as string;
        // Extract plan content from <plan> tags
        const match = content.match(/<plan>([\s\S]*?)<\/plan>/);
        if (match && match[1]) {
          try {
            // Try to parse as JSON array first
            return JSON.parse(match[1]);
          } catch {
            // If not JSON, split by newlines
            return match[1].split('\n').filter(step => step.trim());
          }
        }
      }
    }
    return undefined;
  }
  
  /**
   * Update the existing plan message with a new version
   * @param updatedPlan - The updated plan with checkbox markers
   */
  public updatePlanMessage(updatedPlan: string[]): void {
    // Find and remove the last plan message
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].metadata.messageType === 'plan') {
        this.remove(i);
        break;
      }
    }
    
    // Add the updated plan
    this.addPlanMessage(updatedPlan);
    
    Logging.log('MessageManager', `Updated plan with ${updatedPlan.length} steps`, 'info');
  }
  
  /**
   * Add model output to history - tracks agent's reasoning and planned actions
   * This is crucial for preserving the agent's decision-making process
   * @param output - The model output containing reasoning and actions
   */
  public addModelOutput(output: Record<string, any>): void {
    const toolCallId = this.nextToolId();
    const msg = new AIMessage({
      content: 'tool call',
      tool_calls: [{
        name: 'AgentOutput',
        args: output,
        id: String(toolCallId),
        type: 'tool_call' as const
      }]
    });
    
    this.add(msg, 'ai');
    
    // Add placeholder tool response to maintain conversation flow
    this.addToolMessage('tool call response', 'AgentOutput');
    
    Logging.log('MessageManager', 'Added model output to history', 'info');
  }
  
  
  public addBrowserStateMessage(state: string, position?: number): void {
    const msg = new SystemMessage({ content: state });
    this.add(msg, 'browser_state', position);
  }
  

  /**
   * Remove the last browser state message
   * @returns True if a browser state was removed
   */
  public removeBrowserStateMessages(): boolean {
    // Find the last browser state message
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].metadata.messageType === 'browser_state') {
        const removed = this.remove(i);
        if (removed) {
          Logging.log('MessageManager', 'Removed browser state message', 'info');
        }
        return removed;
      }
    }
    return false;
  }
  
  public clear(): void {
    this.messages = [];
    this.totalTokens = 0;
    this.toolId = 1;
    this.previousTaskType = null;  // Reset previous agent type
    Logging.log('MessageManager', 'Conversation history cleared');
  }

  /**
   * Get messages excluding browser state messages
   * @returns Array of messages without browser states
   */
  public getMessagesWithoutBrowserState(): BaseMessage[] {
    const messages = this.messages
      .filter(m => m.metadata.messageType !== 'browser_state')
      .map(m => m.message);
    
    Logging.log('MessageManager', `Returning ${messages.length} messages (excluding browser states)`, 'info');
    return messages;
  }


  /**
   * Add validation feedback to message history
   * @param suggestions - Array of suggestions from validator
   */
  public addValidationFeedback(suggestions: string[]): void {
    const content = `Validation failed. Suggestions for next steps:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    const msg = new AIMessage({ content });
    this.add(msg, 'validation_feedback');
    
    Logging.log('MessageManager', `Added validation feedback with ${suggestions.length} suggestions`, 'info');
  }

  /**
   * Check if there's a browser state message in the history
   * @returns True if browser state exists
   */
  public hasBrowserState(): boolean {
    return this.messages.some(m => m.metadata.messageType === 'browser_state');
  }

  /**
   * Remove all browser state messages
   * @returns Number of browser states removed
   */
  public removeAllBrowserStates(): number {
    let removed = 0;
    // Iterate backwards to avoid index issues
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].metadata.messageType === 'browser_state') {
        if (this.remove(i)) {
          removed++;
        }
      }
    }
    if (removed > 0) {
      Logging.log('MessageManager', `Removed ${removed} browser state messages`, 'info');
    }
    return removed;
  }

  /**
   * Add initial productivity task message
   * @param task - The productivity task description
   */
  public addProductivityTaskMessage(task: string): void {
    const content = `Productivity task: "${task}"`;
    const msg = new HumanMessage({ content });
    this.add(msg, 'productivity_task');
    
    Logging.log('MessageManager', 'Added productivity task message', 'info');
  }

  /**
   * Add agent's proposal message with structured data
   * @param proposal - The structured proposal object
   * @param formatted - The formatted string representation for display
   */
  public addProductivityAIMessage(proposal: any, formatted: string): void {
    // Store both structured data and formatted version
    const content = {
      proposal: proposal,
      formatted: formatted
    };
    const msg = new AIMessage({ content: JSON.stringify(content) });
    this.add(msg, 'productivity_ai');
    
    Logging.log('MessageManager', 'Added productivity AI message', 'info');
  }

  /**
   * Add user feedback on proposal
   * @param feedback - User's feedback message
   */
  public addProductivityHumanMessage(feedback: string): void {
    const msg = new HumanMessage({ content: feedback });
    this.add(msg, 'productivity_human');
    
    Logging.log('MessageManager', 'Added productivity human message', 'info');
  }

  /**
   * Get the last productivity AI message
   * @returns The last proposal object or undefined
   */
  public getLastProductivityAIMessage(): any | undefined {
    // Search backwards for the most recent productivity_ai message
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].metadata.messageType === 'productivity_ai') {
        const content = this.messages[i].message.content as string;
        try {
          const parsed = JSON.parse(content);
          return parsed.proposal;
        } catch {
          Logging.log('MessageManager', 'Failed to parse productivity AI message', 'warning');
          return undefined;
        }
      }
    }
    return undefined;
  }

  /**
   * Check if we're in a productivity conversation (has AI message)
   * @returns True if there's an active productivity AI message
   */
  public hasProductivityAIMessage(): boolean {
    return this.messages.some(m => m.metadata.messageType === 'productivity_ai');
  }

  /**
   * Clear productivity conversation state
   * Removes all productivity-related messages
   */
  public clearProductivityConversation(): void {
    let removed = 0;
    // Remove all productivity-related messages
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const type = this.messages[i].metadata.messageType;
      if (type === 'productivity_task' || 
          type === 'productivity_ai' || 
          type === 'productivity_human') {
        if (this.remove(i)) {
          removed++;
        }
      }
    }
    
    if (removed > 0) {
      Logging.log('MessageManager', `Cleared productivity conversation (${removed} messages removed)`, 'info');
    }
  }

  /**
   * Get all productivity messages in order
   * @returns Array of productivity messages with their types
   */
  public getProductivityConversation(): Array<{ type: MessageType; content: any }> {
    const productivityMessages = this.messages
      .filter(m => 
        m.metadata.messageType === 'productivity_task' || 
        m.metadata.messageType === 'productivity_ai' || 
        m.metadata.messageType === 'productivity_human'
      )
      .map(m => {
        let content = m.message.content;
        // Parse AI messages to extract the proposal
        if (m.metadata.messageType === 'productivity_ai' && typeof content === 'string') {
          try {
            const parsed = JSON.parse(content);
            content = parsed;
          } catch {
            // Keep as string if parsing fails
          }
        }
        return {
          type: m.metadata.messageType!,
          content: content
        };
      });
    
    return productivityMessages;
  }

  public remove(index = -1): boolean {
    if (this.messages.length === 0) return false;

    const actualIndex = index < 0 ? this.messages.length + index : index;
    if (actualIndex < 0 || actualIndex >= this.messages.length) return false;

    const removed = this.messages.splice(actualIndex, 1)[0];
    this.totalTokens -= removed.metadata.tokens;
    return true;
  }

  public removeLastUserMessage(): boolean {
    if (this.messages.length > 2) {
      const lastMessage = this.messages[this.messages.length - 1];
      if (lastMessage.message instanceof HumanMessage) {
        return this.remove(-1);
      }
    }
    return false;
  }

  public removeOldestNonSystemMessage(): boolean {
    for (let i = 0; i < this.messages.length; i++) {
      if (!(this.messages[i].message instanceof SystemMessage)) {
        return this.remove(i);
      }
    }
    return false;
  }

  public getMessages(isGemini: boolean = false): BaseMessage[] {
    const messages = this.messages.map(m => m.message);
    
    if (isGemini) {
      // Gemini expects SystemMessage to be the first message
      // let's just convert all system messages to ai messages
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].getType() === 'system') {
          messages[i] = new HumanMessage({ content: messages[i].content });
        }
      }
    }

    // Log token usage for debugging
    Logging.log('MessageManager', `Messages in history: ${this.messages.length} - Total input tokens: ${this.totalTokens}`);

    return messages;
  }

  public getMessagesWithMetadata(): TrackedMessage[] {
    return [...this.messages];
  }

  public getTotalTokens(): number {
    return this.totalTokens;
  }

  public length(): number {
    return this.messages.length;
  }

  public isOverBudget(): boolean {
    return this.totalTokens > this.settings.maxInputTokens;
  }

  public getRemainingTokens(): number {
    return Math.max(0, this.settings.maxInputTokens - this.totalTokens);
  }

  public canFit(message: BaseMessage): boolean {
    const tokens = this.countTokens(message);
    return tokens <= this.getRemainingTokens();
  }


  public nextToolId(): number {
    const id = this.toolId;
    this.toolId += 1;
    return id;
  }

  private getMessageTypeFromBase(message: BaseMessage): MessageType {
    if (message instanceof HumanMessage) return 'human';
    if (message instanceof AIMessage) return 'ai';
    if (message instanceof SystemMessage) return 'system';
    if (message instanceof ToolMessage) return 'tool';
    return 'generic';
  }

  /**
   * Trim messages to fit within token budget
   * Removes oldest non-system messages or truncates the last message
   */
  private trimToFit(): void {
    let overBudget = this.totalTokens - this.settings.maxInputTokens;
    if (overBudget <= 0) return;

    const lastMsg = this.messages[this.messages.length - 1];

    // If last message has images, remove them first
    if (Array.isArray(lastMsg.message.content)) {
      let text = '';
      lastMsg.message.content = lastMsg.message.content.filter(item => {
        if ('image_url' in item) {
          overBudget -= this.settings.imageTokens;
          lastMsg.metadata.tokens -= this.settings.imageTokens;
          this.totalTokens -= this.settings.imageTokens;
          Logging.log(
            'MessageManager',
            `Removed image with ${this.settings.imageTokens} tokens - total tokens now: ${this.totalTokens}/${this.settings.maxInputTokens}`,
          );
          return false;
        }
        if ('text' in item) {
          text += item.text;
        }
        return true;
      });
      lastMsg.message.content = text;
    }

    if (overBudget <= 0) return;
    
    // let's old tool & AI messages from oldest to newest
    for (let i = 0; i < this.messages.length; i++) {
      if (this.messages[i].metadata.messageType === 'tool' || this.messages[i].metadata.messageType === 'ai') {
        const removedMsg = this.messages[i];
        this.remove(i);
        overBudget -= removedMsg.metadata.tokens;
        if (overBudget <= 0) return;
      }
    }

    // if still over budget, throw an error. 
    // the user content is too large.
    overBudget = this.totalTokens - this.settings.maxInputTokens;
    if (overBudget > 0) {
      throw new Error(
        `Max token limit reached - Content is too large.`,
      );
    }
  }


  /**
   * Count tokens in a message
   * @param message - Message to count tokens for
   * @returns Token count
   */
  private countTokens(message: BaseMessage): number {
    let tokens = 0;

    if (Array.isArray(message.content)) {
      for (const item of message.content) {
        if ('image_url' in item) {
          tokens += this.settings.imageTokens;
        } else if (typeof item === 'object' && 'text' in item) {
          tokens += this.countTextTokens(item.text);
        }
      }
    } else {
      let msg = message.content;
      // Check if it's an AIMessage with tool_calls
      if ('tool_calls' in message) {
        msg += JSON.stringify(message.tool_calls);
      }
      tokens += this.countTextTokens(msg);
    }

    return tokens;
  }

  /**
   * Count tokens in text (rough estimate)
   * @param text - Text to count
   * @returns Estimated token count
   */
  private countTextTokens(text: string): number {
    return Math.floor(text.length / this.settings.estimatedCharactersPerToken);
  }
  
  /**
   * Set the last task type that was classified
   * @param taskType - The type of task that was classified (productivity or browse)
   */
  public setPreviousTaskType(taskType: 'productivity' | 'browse' | 'answer' | null): void {
    this.previousTaskType = taskType;
    Logging.log('MessageManager', `Set previous task type to: ${taskType}`, 'info');
  }
  
  /**
   * Get the previous task type that was classified
   * @returns The previous task type or null if none
   */
  public getPreviousTaskType(): 'productivity' | 'browse' | 'answer' | null {
    return this.previousTaskType;
  }
}
