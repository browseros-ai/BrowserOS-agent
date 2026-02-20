import type { ToolLoopAgent, UIMessage } from 'ai'
import { logger } from '../../lib/logger'

export interface AgentSession {
  agent: ToolLoopAgent
  messages: UIMessage[]
  mcpClients: Array<{ close(): Promise<void> }>
}

export class SessionStore {
  private sessions = new Map<string, AgentSession>()

  get(conversationId: string): AgentSession | undefined {
    return this.sessions.get(conversationId)
  }

  set(conversationId: string, session: AgentSession): void {
    this.sessions.set(conversationId, session)
    logger.info('Session added to store', {
      conversationId,
      totalSessions: this.sessions.size,
    })
  }

  has(conversationId: string): boolean {
    return this.sessions.has(conversationId)
  }

  async delete(conversationId: string): Promise<boolean> {
    const session = this.sessions.get(conversationId)
    if (!session) return false

    for (const client of session.mcpClients) {
      await client.close().catch(() => {})
    }

    this.sessions.delete(conversationId)
    logger.info('Session deleted', {
      conversationId,
      remainingSessions: this.sessions.size,
    })
    return true
  }

  count(): number {
    return this.sessions.size
  }
}
