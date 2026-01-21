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

  getMutex(windowId?: number): Mutex {
    if (!windowId) return this.globalMutex

    let mutex = this.mutexes.get(windowId)
    if (!mutex) {
      mutex = new Mutex()
      this.mutexes.set(windowId, mutex)
    }
    return mutex
  }

  removeMutex(windowId: number): void {
    this.mutexes.delete(windowId)
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
}
