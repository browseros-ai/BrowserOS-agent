/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { MCPServerConfig } from '@google/gemini-cli-core'
import { logger } from '../lib/logger'

import { GeminiAgent } from './gemini-agent'
import type { McpServerSpec, ResolvedAgentConfig } from './types'
import { VercelToolLoopAgent } from './vercel-tool-loop-agent'

export type AgentRuntime = 'gemini' | 'vercel-tool-loop'

interface SessionAgent {
  execute: GeminiAgent['execute']
  getHistory: () => unknown[]
  dispose?: () => void
}

function createMcpServerConfig(server: McpServerSpec): MCPServerConfig {
  return new MCPServerConfig(
    undefined,
    undefined,
    undefined,
    undefined,
    server.transport === 'sse' ? server.url : undefined,
    server.transport === 'streamable-http' ? server.url : undefined,
    server.headers,
    undefined,
    undefined,
    server.trust,
  )
}

export class SessionManager {
  private sessions = new Map<string, SessionAgent>()

  constructor(private runtime: AgentRuntime = 'gemini') {}

  async getOrCreate(
    config: ResolvedAgentConfig,
    mcpServers: Record<string, McpServerSpec>,
  ): Promise<SessionAgent> {
    const existing = this.sessions.get(config.conversationId)

    if (existing) {
      logger.info('Reusing existing session', {
        conversationId: config.conversationId,
        historyLength: existing.getHistory().length,
      })
      return existing
    }

    const agent =
      this.runtime === 'vercel-tool-loop'
        ? await VercelToolLoopAgent.create(config, mcpServers)
        : await GeminiAgent.create(
            config,
            Object.fromEntries(
              Object.entries(mcpServers).map(([name, server]) => [
                name,
                createMcpServerConfig(server),
              ]),
            ),
          )
    this.sessions.set(config.conversationId, agent)

    logger.info('Session added to manager', {
      conversationId: config.conversationId,
      totalSessions: this.sessions.size,
      runtime: this.runtime,
    })

    return agent
  }

  delete(conversationId: string): boolean {
    const session = this.sessions.get(conversationId)
    if (session) {
      session.dispose?.()
      this.sessions.delete(conversationId)
      logger.info('Session deleted', {
        conversationId,
        remainingSessions: this.sessions.size,
      })
      return true
    }
    return false
  }

  count(): number {
    return this.sessions.size
  }

  has(conversationId: string): boolean {
    return this.sessions.has(conversationId)
  }
}
