import { MemoryEvent } from "./types";

/**
 * MemoryEventBus - Event coordination for memory operations
 *
 * This class handles memory-related events for coordination between
 * different components and UI updates.
 */
export class MemoryEventBus {
  private listeners: Map<string, ((event: MemoryEvent) => void)[]> = new Map();
  private globalListeners: ((event: MemoryEvent) => void)[] = [];

  /**
   * Emit a memory event
   */
  emit(type: MemoryEvent["type"], data: MemoryEvent["data"]): void {
    const event: MemoryEvent = {
      type,
      data,
    };

    // Call type-specific listeners
    const typeListeners = this.listeners.get(type) || [];
    typeListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in memory event listener:", error);
      }
    });

    // Call global listeners
    this.globalListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in global memory event listener:", error);
      }
    });
  }

  /**
   * Subscribe to specific event types
   */
  on(type: MemoryEvent["type"], callback: (event: MemoryEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  /**
   * Subscribe to all events
   */
  subscribe(callback: (event: MemoryEvent) => void): void {
    this.globalListeners.push(callback);
  }

  /**
   * Unsubscribe from specific event type
   */
  off(type: MemoryEvent["type"], callback: (event: MemoryEvent) => void): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      const index = typeListeners.indexOf(callback);
      if (index > -1) {
        typeListeners.splice(index, 1);
      }
    }
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribe(callback: (event: MemoryEvent) => void): void {
    const index = this.globalListeners.indexOf(callback);
    if (index > -1) {
      this.globalListeners.splice(index, 1);
    }
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.globalListeners = [];
  }

  /**
   * Get listener counts for debugging
   */
  getListenerCounts(): Record<string, number> {
    const counts: Record<string, number> = {
      global: this.globalListeners.length,
    };

    this.listeners.forEach((listeners, type) => {
      counts[type] = listeners.length;
    });

    return counts;
  }
}
