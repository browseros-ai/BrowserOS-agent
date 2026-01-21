/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Pool of mutexes for per-window isolation.
 * Allows parallel tool execution across different browser windows
 * while preventing concurrent operations on the same window.
 */
export class MutexPool {
  private mutexes = new Map<number, Mutex>()
  private globalMutex = new Mutex()
  private static MAX_MUTEXES = 50

  getMutex(windowId?: number): Mutex {
    if (!windowId) return this.globalMutex

    let mutex = this.mutexes.get(windowId)
    if (!mutex) {
      // Prevent unbounded growth - evict an idle mutex if at limit
      if (this.mutexes.size >= MutexPool.MAX_MUTEXES) {
        this.evictIdleMutex()
      }
      mutex = new Mutex()
      this.mutexes.set(windowId, mutex)
    }
    return mutex
  }

  /**
   * Evicts an idle (unlocked, no waiters) mutex from the pool.
   * Only removes mutexes that are safe to delete.
   */
  private evictIdleMutex(): void {
    for (const [key, mutex] of this.mutexes) {
      if (mutex.isIdle()) {
        this.mutexes.delete(key)
        return
      }
    }
    // All mutexes are in use - allow pool to grow temporarily
    // This is safer than breaking mutual exclusion
  }

  removeMutex(windowId: number): void {
    const mutex = this.mutexes.get(windowId)
    // Only remove if idle to prevent breaking mutual exclusion
    if (mutex && mutex.isIdle()) {
      this.mutexes.delete(windowId)
    }
  }
}

export class Mutex {
  static Guard = class Guard {
    #mutex: Mutex
    constructor(mutex: Mutex) {
      this.#mutex = mutex
    }
    dispose(): void {
      this.#mutex.release()
    }
  }

  #locked = false
  #acquirers: Array<() => void> = []

  // This is FIFO.
  async acquire(): Promise<InstanceType<typeof Mutex.Guard>> {
    if (!this.#locked) {
      this.#locked = true
      return new Mutex.Guard(this)
    }
    const { resolve, promise } = Promise.withResolvers<void>()
    this.#acquirers.push(resolve)
    await promise
    return new Mutex.Guard(this)
  }

  release(): void {
    const resolve = this.#acquirers.shift()
    if (!resolve) {
      this.#locked = false
      return
    }
    resolve()
  }

  /**
   * Returns true if the mutex is not locked and has no pending waiters.
   * Safe to evict from pool when idle.
   */
  isIdle(): boolean {
    return !this.#locked && this.#acquirers.length === 0
  }
}
