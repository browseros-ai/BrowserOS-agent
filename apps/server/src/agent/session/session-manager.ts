/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { MCPServerConfig } from '@google/gemini-cli-core'
import { logger } from '../../common/logger'

import { GeminiAgent } from '../agent/gemini-agent'
import type { ResolvedAgentConfig } from '../agent/types'

export class SessionManager {
  private sessions = new Map<string, GeminiAgent>()

  async getOrCreate(
    config: ResolvedAgentConfig,
    mcpServers: Record<string, MCPServerConfig>,
  ): Promise<GeminiAgent> {
    const existing = this.sessions.get(config.conversationId)

    if (existing) {
      logger.info('Reusing existing session', {
        conversationId: config.conversationId,
        historyLength: existing.getHistory().length,
      })
      return existing
    }

    const agent = await GeminiAgent.create(config, mcpServers)
    this.sessions.set(config.conversationId, agent)

    logger.info('Session added to manager', {
      conversationId: config.conversationId,
      totalSessions: this.sessions.size,
    })

    return agent
  }

  delete(conversationId: string): boolean {
    const deleted = this.sessions.delete(conversationId)
    if (deleted) {
      logger.info('Session deleted', {
        conversationId,
        remainingSessions: this.sessions.size,
      })
    }
    return deleted
  }

  count(): number {
    return this.sessions.size
  }

  has(conversationId: string): boolean {
    return this.sessions.has(conversationId)
  }
}
