/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { MCPServerConfig } from '@google/gemini-cli-core'
import { logger } from '../lib/logger'

import { GeminiAgent } from './gemini-agent'
import type { ResolvedAgentConfig } from './types'

export interface Session {
  agent: GeminiAgent
}

export class SessionManager {
  private sessions = new Map<string, Session>()

  async getOrCreate(
    config: ResolvedAgentConfig,
    mcpServers: Record<string, MCPServerConfig>,
  ): Promise<Session> {
    const existing = this.sessions.get(config.conversationId)

    if (existing) {
      logger.info('Reusing existing session', {
        conversationId: config.conversationId,
        historyLength: existing.agent.getHistory().length,
      })
      return existing
    }

    const agent = await GeminiAgent.create(config, mcpServers)
    const session: Session = { agent }
    this.sessions.set(config.conversationId, session)

    logger.info('Session added to manager', {
      conversationId: config.conversationId,
      totalSessions: this.sessions.size,
    })

    return session
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
