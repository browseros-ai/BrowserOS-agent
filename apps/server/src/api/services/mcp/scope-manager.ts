/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { SessionManager } from '../../../agent/session'
import { SessionState } from '../../../browser/session-state'
import { logger } from '../../../lib/logger'

export const MCP_SCOPE_HEADER = 'X-BrowserOS-Scope-Id'

const MCP_SCOPE_TTL_MS = 30 * 60 * 1000
const MCP_SCOPE_SWEEP_MS = 5 * 60 * 1000

export const scopeIdStore = new AsyncLocalStorage<string | undefined>()

interface McpScopeEntry {
  state: SessionState
  lastAccess: number
}

export class McpScopeManager {
  #scopes = new Map<string, McpScopeEntry>()
  #sessionManager: SessionManager
  #sweepTimer: ReturnType<typeof setInterval> | null = null

  constructor(sessionManager: SessionManager) {
    this.#sessionManager = sessionManager
  }

  resolve(scopeId: string | undefined): SessionState {
    if (!scopeId) {
      return new SessionState()
    }

    const conversationState = this.#sessionManager.getSessionState(scopeId)
    if (conversationState) {
      return conversationState
    }

    const existing = this.#scopes.get(scopeId)
    if (existing) {
      existing.lastAccess = Date.now()
      return existing.state
    }

    const state = new SessionState()
    this.#scopes.set(scopeId, { state, lastAccess: Date.now() })
    return state
  }

  startSweep(): void {
    this.#sweepTimer = setInterval(() => {
      const now = Date.now()
      for (const [id, entry] of this.#scopes) {
        if (now - entry.lastAccess > MCP_SCOPE_TTL_MS) {
          this.#scopes.delete(id)
          logger.debug('Expired MCP scope', { scopeId: id })
        }
      }
    }, MCP_SCOPE_SWEEP_MS)
  }

  dispose(): void {
    if (this.#sweepTimer) {
      clearInterval(this.#sweepTimer)
      this.#sweepTimer = null
    }
  }
}
