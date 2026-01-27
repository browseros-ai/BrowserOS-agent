/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmWindowManager
 *
 * Manages browser windows for AI Swarm Mode. Handles:
 * - Creating worker windows with proper isolation
 * - Tracking swarm-owned windows
 * - Window lifecycle (create, focus, minimize, close)
 * - Cascading window positions for visibility
 * - Cleanup on swarm termination
 */
import { z } from 'zod'
import { CHROME_API_TIMEOUTS, withTimeout } from '@/utils/timeout'
import { logger } from '@/utils/logger'

// ============================================================================
// Types
// ============================================================================

export interface SwarmWindow {
  windowId: number
  tabId: number
  swarmId: string
  workerId: string
  createdAt: number
  state: 'active' | 'minimized' | 'focused'
  position: { left: number; top: number; width: number; height: number }
}

export interface CreateSwarmWindowInput {
  swarmId: string
  workerId: string
  url?: string
  position?: {
    left?: number
    top?: number
    width?: number
    height?: number
  }
  focused?: boolean
  incognito?: boolean
}

export interface CreateSwarmWindowOutput {
  windowId: number
  tabId: number
  position: { left: number; top: number; width: number; height: number }
}

// ============================================================================
// Window Manager
// ============================================================================

export class SwarmWindowManager {
  // Map of swarmId -> workerId -> SwarmWindow
  private swarmWindows = new Map<string, Map<string, SwarmWindow>>()

  // Default window dimensions
  private readonly DEFAULT_WIDTH = 1024
  private readonly DEFAULT_HEIGHT = 768
  private readonly CASCADE_OFFSET = 30
  private readonly MIN_LEFT = 50
  private readonly MIN_TOP = 50

  /**
   * Get all windows for a swarm
   */
  getSwarmWindows(swarmId: string): SwarmWindow[] {
    const windows = this.swarmWindows.get(swarmId)
    return windows ? Array.from(windows.values()) : []
  }

  /**
   * Get a specific worker window
   */
  getWorkerWindow(swarmId: string, workerId: string): SwarmWindow | undefined {
    return this.swarmWindows.get(swarmId)?.get(workerId)
  }

  /**
   * Create a new worker window for a swarm
   */
  async createWorkerWindow(
    input: CreateSwarmWindowInput
  ): Promise<CreateSwarmWindowOutput> {
    const { swarmId, workerId, url, position, focused, incognito } = input

    // Calculate cascading position
    const existingWindows = this.getSwarmWindows(swarmId)
    const cascadeIndex = existingWindows.length
    const calculatedPosition = {
      left: position?.left ?? this.MIN_LEFT + cascadeIndex * this.CASCADE_OFFSET,
      top: position?.top ?? this.MIN_TOP + cascadeIndex * this.CASCADE_OFFSET,
      width: position?.width ?? this.DEFAULT_WIDTH,
      height: position?.height ?? this.DEFAULT_HEIGHT,
    }

    logger.info('[SwarmWindowManager] Creating worker window', {
      swarmId,
      workerId,
      position: calculatedPosition,
    })

    // Create the window via Chrome API
    const createData: chrome.windows.CreateData = {
      url: url || 'about:blank',
      type: 'normal',
      focused: focused ?? false,
      incognito: incognito ?? false,
      left: calculatedPosition.left,
      top: calculatedPosition.top,
      width: calculatedPosition.width,
      height: calculatedPosition.height,
    }

    const window = await withTimeout(
      chrome.windows.create(createData),
      CHROME_API_TIMEOUTS.CHROME_API,
      'chrome.windows.create (swarm)'
    )

    if (!window || window.id === undefined) {
      throw new Error('Failed to create swarm worker window')
    }

    const tabId = window.tabs?.[0]?.id
    if (tabId === undefined) {
      throw new Error('Created window has no tab')
    }

    // Track the window
    const swarmWindow: SwarmWindow = {
      windowId: window.id,
      tabId,
      swarmId,
      workerId,
      createdAt: Date.now(),
      state: focused ? 'focused' : 'active',
      position: calculatedPosition,
    }

    if (!this.swarmWindows.has(swarmId)) {
      this.swarmWindows.set(swarmId, new Map())
    }
    this.swarmWindows.get(swarmId)!.set(workerId, swarmWindow)

    logger.info('[SwarmWindowManager] Worker window created', {
      swarmId,
      workerId,
      windowId: window.id,
      tabId,
    })

    return {
      windowId: window.id,
      tabId,
      position: calculatedPosition,
    }
  }

  /**
   * Navigate a worker window to a URL
   */
  async navigateWorkerWindow(
    swarmId: string,
    workerId: string,
    url: string
  ): Promise<void> {
    const swarmWindow = this.getWorkerWindow(swarmId, workerId)
    if (!swarmWindow) {
      throw new Error(`Worker window not found: ${swarmId}/${workerId}`)
    }

    await withTimeout(
      chrome.tabs.update(swarmWindow.tabId, { url }),
      CHROME_API_TIMEOUTS.CHROME_API,
      'chrome.tabs.update'
    )

    logger.debug('[SwarmWindowManager] Worker window navigated', {
      swarmId,
      workerId,
      url,
    })
  }

  /**
   * Focus a worker window
   */
  async focusWorkerWindow(swarmId: string, workerId: string): Promise<void> {
    const swarmWindow = this.getWorkerWindow(swarmId, workerId)
    if (!swarmWindow) {
      throw new Error(`Worker window not found: ${swarmId}/${workerId}`)
    }

    await withTimeout(
      chrome.windows.update(swarmWindow.windowId, { focused: true }),
      CHROME_API_TIMEOUTS.CHROME_API,
      'chrome.windows.update'
    )

    swarmWindow.state = 'focused'
    logger.debug('[SwarmWindowManager] Worker window focused', {
      swarmId,
      workerId,
    })
  }

  /**
   * Minimize a worker window
   */
  async minimizeWorkerWindow(swarmId: string, workerId: string): Promise<void> {
    const swarmWindow = this.getWorkerWindow(swarmId, workerId)
    if (!swarmWindow) {
      throw new Error(`Worker window not found: ${swarmId}/${workerId}`)
    }

    await withTimeout(
      chrome.windows.update(swarmWindow.windowId, { state: 'minimized' }),
      CHROME_API_TIMEOUTS.CHROME_API,
      'chrome.windows.update'
    )

    swarmWindow.state = 'minimized'
    logger.debug('[SwarmWindowManager] Worker window minimized', {
      swarmId,
      workerId,
    })
  }

  /**
   * Close a specific worker window
   */
  async closeWorkerWindow(swarmId: string, workerId: string): Promise<void> {
    const swarmWindow = this.getWorkerWindow(swarmId, workerId)
    if (!swarmWindow) {
      logger.warn('[SwarmWindowManager] Worker window not found for close', {
        swarmId,
        workerId,
      })
      return
    }

    try {
      await withTimeout(
        chrome.windows.remove(swarmWindow.windowId),
        CHROME_API_TIMEOUTS.CHROME_API,
        'chrome.windows.remove'
      )
    } catch (error) {
      // Window may already be closed
      logger.debug('[SwarmWindowManager] Window already closed', {
        swarmId,
        workerId,
        error,
      })
    }

    // Remove from tracking
    this.swarmWindows.get(swarmId)?.delete(workerId)
    if (this.swarmWindows.get(swarmId)?.size === 0) {
      this.swarmWindows.delete(swarmId)
    }

    logger.info('[SwarmWindowManager] Worker window closed', {
      swarmId,
      workerId,
    })
  }

  /**
   * Close all windows for a swarm
   */
  async terminateSwarm(swarmId: string): Promise<void> {
    const windows = this.getSwarmWindows(swarmId)
    if (windows.length === 0) {
      logger.debug('[SwarmWindowManager] No windows to terminate', { swarmId })
      return
    }

    logger.info('[SwarmWindowManager] Terminating swarm windows', {
      swarmId,
      windowCount: windows.length,
    })

    // Close all windows in parallel
    const closePromises = windows.map(async (w) => {
      try {
        await chrome.windows.remove(w.windowId)
      } catch (error) {
        // Ignore errors for already-closed windows
      }
    })

    await Promise.all(closePromises)

    // Clean up tracking
    this.swarmWindows.delete(swarmId)

    logger.info('[SwarmWindowManager] Swarm terminated', { swarmId })
  }

  /**
   * Arrange all swarm windows in a grid layout
   */
  async arrangeSwarmWindows(
    swarmId: string,
    layout: 'grid' | 'cascade' | 'tile' = 'grid'
  ): Promise<void> {
    const windows = this.getSwarmWindows(swarmId)
    if (windows.length === 0) return

    // Get screen dimensions (approximate)
    const screenWidth = 1920
    const screenHeight = 1080

    if (layout === 'grid') {
      const cols = Math.ceil(Math.sqrt(windows.length))
      const rows = Math.ceil(windows.length / cols)
      const cellWidth = Math.floor(screenWidth / cols)
      const cellHeight = Math.floor(screenHeight / rows)

      const updatePromises = windows.map(async (w, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const position = {
          left: col * cellWidth,
          top: row * cellHeight,
          width: cellWidth,
          height: cellHeight,
        }

        await chrome.windows.update(w.windowId, position)
        w.position = position
      })

      await Promise.all(updatePromises)
    } else if (layout === 'cascade') {
      const updatePromises = windows.map(async (w, i) => {
        const position = {
          left: this.MIN_LEFT + i * this.CASCADE_OFFSET,
          top: this.MIN_TOP + i * this.CASCADE_OFFSET,
          width: this.DEFAULT_WIDTH,
          height: this.DEFAULT_HEIGHT,
        }

        await chrome.windows.update(w.windowId, position)
        w.position = position
      })

      await Promise.all(updatePromises)
    } else if (layout === 'tile') {
      // Horizontal tiling
      const tileWidth = Math.floor(screenWidth / windows.length)
      const updatePromises = windows.map(async (w, i) => {
        const position = {
          left: i * tileWidth,
          top: 0,
          width: tileWidth,
          height: screenHeight,
        }

        await chrome.windows.update(w.windowId, position)
        w.position = position
      })

      await Promise.all(updatePromises)
    }

    logger.info('[SwarmWindowManager] Windows arranged', { swarmId, layout })
  }

  /**
   * Get a screenshot of a worker window's current state
   */
  async captureWorkerScreenshot(
    swarmId: string,
    workerId: string
  ): Promise<string> {
    const swarmWindow = this.getWorkerWindow(swarmId, workerId)
    if (!swarmWindow) {
      throw new Error(`Worker window not found: ${swarmId}/${workerId}`)
    }

    const dataUrl = await withTimeout(
      chrome.tabs.captureVisibleTab(swarmWindow.windowId, { format: 'png' }),
      CHROME_API_TIMEOUTS.CHROME_API,
      'chrome.tabs.captureVisibleTab'
    )

    return dataUrl
  }

  /**
   * Handle window closed externally (user closed it)
   */
  handleWindowClosed(windowId: number): void {
    // Find and remove the window from tracking
    for (const [swarmId, workers] of this.swarmWindows) {
      for (const [workerId, window] of workers) {
        if (window.windowId === windowId) {
          workers.delete(workerId)
          logger.info('[SwarmWindowManager] Window externally closed', {
            swarmId,
            workerId,
            windowId,
          })

          if (workers.size === 0) {
            this.swarmWindows.delete(swarmId)
          }
          return
        }
      }
    }
  }

  /**
   * Get statistics about active swarms
   */
  getStats(): {
    totalSwarms: number
    totalWindows: number
    swarmDetails: Array<{ swarmId: string; windowCount: number }>
  } {
    const swarmDetails: Array<{ swarmId: string; windowCount: number }> = []
    let totalWindows = 0

    for (const [swarmId, workers] of this.swarmWindows) {
      const windowCount = workers.size
      swarmDetails.push({ swarmId, windowCount })
      totalWindows += windowCount
    }

    return {
      totalSwarms: this.swarmWindows.size,
      totalWindows,
      swarmDetails,
    }
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

export const swarmWindowManager = new SwarmWindowManager()
