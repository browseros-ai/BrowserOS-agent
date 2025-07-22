import { Message, MessageSchema } from './Message'

export interface ConversationHistoryOptions {
  maxMessages?: number  // Maximum messages to keep in memory
  summarizeThreshold?: number  // When to trigger summarization
}

export class ConversationHistory {
  private messages: Message[] = []
  private options: ConversationHistoryOptions

  constructor(options: ConversationHistoryOptions = {}) {
    this.options = {
      maxMessages: options.maxMessages ?? 100,
      summarizeThreshold: options.summarizeThreshold ?? 50
    }
  }

  addMessage(message: Message): void {
    const validated = MessageSchema.parse(message)
    this.messages.push(validated)
    
    // Trim if exceeding max messages
    if (this.messages.length > this.options.maxMessages!) {
      this.messages = this.messages.slice(-this.options.maxMessages!)
    }
  }

  getMessages(options?: { limit?: number; offset?: number }): Message[] {
    const { limit, offset = 0 } = options ?? {}
    
    if (limit) {
      return this.messages.slice(offset, offset + limit)
    }
    
    return this.messages.slice(offset)
  }

  getLastMessage(): Message | undefined {
    return this.messages[this.messages.length - 1]
  }

  getMessageCount(): number {
    return this.messages.length
  }

  clear(): void {
    this.messages = []
  }

  // Get messages formatted for LLM consumption
  formatForLLM(): Message[] {
    return this.messages
  }

  // TODO: Implement summarization for long conversations
  async summarize(): Promise<string> {
    throw new Error('Summarization not yet implemented')
  }
}