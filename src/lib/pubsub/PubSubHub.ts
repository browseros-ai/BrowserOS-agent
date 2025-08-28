import { PubSubChannel } from './PubSubChannel'
import { Logging } from '@/lib/utils/Logging'

/**
 * PubSubHub manages scoped PubSub channels for execution isolation.
 * Each execution gets its own channel to prevent message cross-talk.
 */
export class PubSubHub {
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
    let channel = PubSubHub.channels.get(executionId)
    if (channel) {
      // Clear any pending cleanup timer
      PubSubHub.clearCleanupTimer(executionId)
      return channel
    }
    
    // Create new channel
    channel = new PubSubChannel(executionId)
    PubSubHub.channels.set(executionId, channel)
    
    Logging.log('PubSubHub', `Created channel for execution ${executionId} (total: ${PubSubHub.channels.size})`)
    
    return channel
  }
  
  /**
   * Delete a PubSub channel
   * @param executionId - The execution identifier
   * @param immediate - If true, delete immediately without cleanup timer
   */
  static deleteChannel(executionId: string, immediate: boolean = false): void {
    if (immediate) {
      PubSubHub.performChannelCleanup(executionId)
    } else {
      // Schedule cleanup with timeout (allows for reconnection)
      PubSubHub.scheduleCleanup(executionId)
    }
  }
  
  /**
   * Perform actual channel cleanup
   * @private
   */
  private static performChannelCleanup(executionId: string): void {
    const channel = PubSubHub.channels.get(executionId)
    if (!channel) {
      return
    }
    
    // Destroy the channel
    channel.destroy()
    
    // Remove from map
    PubSubHub.channels.delete(executionId)
    
    // Clear any cleanup timer
    PubSubHub.clearCleanupTimer(executionId)
    
    Logging.log('PubSubHub', `Deleted channel for execution ${executionId} (remaining: ${PubSubHub.channels.size})`)
  }
  
  /**
   * Schedule channel cleanup after timeout
   * @private
   */
  private static scheduleCleanup(executionId: string): void {
    // Clear any existing timer
    PubSubHub.clearCleanupTimer(executionId)
    
    // Schedule new cleanup
    const timer = setTimeout(() => {
      Logging.log('PubSubHub', `Auto-cleanup triggered for channel ${executionId}`)
      PubSubHub.performChannelCleanup(executionId)
    }, PubSubHub.CHANNEL_CLEANUP_TIMEOUT)
    
    PubSubHub.cleanupTimers.set(executionId, timer)
  }
  
  /**
   * Clear cleanup timer for a channel
   * @private
   */
  private static clearCleanupTimer(executionId: string): void {
    const timer = PubSubHub.cleanupTimers.get(executionId)
    if (timer) {
      clearTimeout(timer)
      PubSubHub.cleanupTimers.delete(executionId)
    }
  }
  
  /**
   * Check if a channel exists
   * @param executionId - The execution identifier
   * @returns True if channel exists
   */
  static hasChannel(executionId: string): boolean {
    return PubSubHub.channels.has(executionId)
  }
  
  /**
   * Get all active channel IDs
   * @returns Array of execution IDs with active channels
   */
  static getActiveChannelIds(): string[] {
    return Array.from(PubSubHub.channels.keys())
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
      totalChannels: PubSubHub.channels.size,
      channelIds: Array.from(PubSubHub.channels.keys()),
      pendingCleanups: PubSubHub.cleanupTimers.size
    }
  }
  
  /**
   * Delete all channels (for cleanup/testing)
   */
  static deleteAllChannels(): void {
    // Clear all timers
    for (const timer of PubSubHub.cleanupTimers.values()) {
      clearTimeout(timer)
    }
    PubSubHub.cleanupTimers.clear()
    
    // Destroy all channels
    for (const [id, channel] of PubSubHub.channels) {
      channel.destroy()
    }
    PubSubHub.channels.clear()
    
    Logging.log('PubSubHub', 'Deleted all channels')
  }
  
  /**
   * Get the default channel (for backwards compatibility)
   * @returns The default channel
   */
  static getDefaultChannel(): PubSubChannel {
    return PubSubHub.getChannel('default')
  }
}