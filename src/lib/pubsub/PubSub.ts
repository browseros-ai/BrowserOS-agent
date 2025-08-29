import { PubSubChannel } from './PubSubChannel'
import { Logging } from '@/lib/utils/Logging'
import { Message } from './types'

/**
 * PubSub manages scoped PubSub channels for execution isolation.
 * Each execution gets its own channel to prevent message cross-talk.
 */
export class PubSub {
  private static channels: Map<string, PubSubChannel> = new Map()
  private static cleanupTimers: Map<string, NodeJS.Timeout> = new Map()
  
  // Channel cleanup timeout (10 minutes)
  private static readonly CHANNEL_CLEANUP_TIMEOUT = 10 * 60 * 1000
  
  /**
   * Get or create a PubSub channel for an execution
   * @param executionId - The unique execution identifier
   * @returns The scoped PubSub channel
   */
  static getChannel(executionId: string): PubSubChannel {
    // Return existing channel if available
    let channel = PubSub.channels.get(executionId)
    if (channel) {
      // Clear any pending cleanup timer
      PubSub.clearCleanupTimer(executionId)
      return channel
    }
    
    // Create new channel
    channel = new PubSubChannel(executionId)
    PubSub.channels.set(executionId, channel)
    
    Logging.log('PubSub', `Created channel for execution ${executionId} (total: ${PubSub.channels.size})`)
    
    return channel
  }
  
  /**
   * Delete a PubSub channel
   * @param executionId - The execution identifier
   * @param immediate - If true, delete immediately without cleanup timer
   */
  static deleteChannel(executionId: string, immediate: boolean = false): void {
    if (immediate) {
      PubSub.performChannelCleanup(executionId)
    } else {
      // Schedule cleanup with timeout (allows for reconnection)
      PubSub.scheduleCleanup(executionId)
    }
  }
  
  /**
   * Perform actual channel cleanup
   * @private
   */
  private static performChannelCleanup(executionId: string): void {
    const channel = PubSub.channels.get(executionId)
    if (!channel) {
      return
    }
    
    // Destroy the channel
    channel.destroy()
    
    // Remove from map
    PubSub.channels.delete(executionId)
    
    // Clear any cleanup timer
    PubSub.clearCleanupTimer(executionId)
    
    Logging.log('PubSub', `Deleted channel for execution ${executionId} (remaining: ${PubSub.channels.size})`)
  }
  
  /**
   * Schedule channel cleanup after timeout
   * @private
   */
  private static scheduleCleanup(executionId: string): void {
    // Clear any existing timer
    PubSub.clearCleanupTimer(executionId)
    
    // Schedule new cleanup
    const timer = setTimeout(() => {
      Logging.log('PubSub', `Auto-cleanup triggered for channel ${executionId}`)
      PubSub.performChannelCleanup(executionId)
    }, PubSub.CHANNEL_CLEANUP_TIMEOUT)
    
    PubSub.cleanupTimers.set(executionId, timer)
  }
  
  /**
   * Clear cleanup timer for a channel
   * @private
   */
  private static clearCleanupTimer(executionId: string): void {
    const timer = PubSub.cleanupTimers.get(executionId)
    if (timer) {
      clearTimeout(timer)
      PubSub.cleanupTimers.delete(executionId)
    }
  }
  
  /**
   * Check if a channel exists
   * @param executionId - The execution identifier
   * @returns True if channel exists
   */
  static hasChannel(executionId: string): boolean {
    return PubSub.channels.has(executionId)
  }
  
  /**
   * Get all active channel IDs
   * @returns Array of execution IDs with active channels
   */
  static getActiveChannelIds(): string[] {
    return Array.from(PubSub.channels.keys())
  }
  
  /**
   * Get statistics about channels
   */
  static getStats(): {
    totalChannels: number
    channelIds: string[]
    pendingCleanups: number
  } {
    return {
      totalChannels: PubSub.channels.size,
      channelIds: Array.from(PubSub.channels.keys()),
      pendingCleanups: PubSub.cleanupTimers.size
    }
  }
  
  /**
   * Delete all channels (for cleanup/testing)
   */
  static deleteAllChannels(): void {
    // Clear all timers
    for (const timer of PubSub.cleanupTimers.values()) {
      clearTimeout(timer)
    }
    PubSub.cleanupTimers.clear()
    
    // Destroy all channels
    for (const [id, channel] of PubSub.channels) {
      channel.destroy()
    }
    PubSub.channels.clear()
    
    Logging.log('PubSub', 'Deleted all channels')
  }
  
  // ============ Helper methods for creating messages ============
  
  /**
   * Helper to generate a unique message ID
   */
  static generateId(prefix: string = 'msg'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Helper to create message with auto-generated ID
   */
  static createMessage(content: string, role: Message['role'] = 'thinking'): Message {
    const msgId = PubSub.generateId(`msg_${role}`)
    return {
      msgId,
      content,
      role,
      ts: Date.now()
    }
  }
  
  /**
   * Helper to create message with specific ID
   */
  static createMessageWithId(msgId: string, content: string, role: Message['role'] = 'thinking'): Message {
    return {
      msgId,
      content,
      role,
      ts: Date.now()
    }
  }
}