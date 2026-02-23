import {
  createProtocolApi,
  type RawOn,
  type RawSend,
} from '@browseros/cdp-protocol/create-api'
import type { ProtocolApi } from '@browseros/cdp-protocol/protocol-api'
import type { CdpTarget, CdpBackend as ICdpBackend } from './types'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

// biome-ignore lint/correctness/noUnusedVariables: declaration merging adds ProtocolApi properties to the class
interface CdpBackend extends ProtocolApi {}
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: intentional — Object.assign fills these at runtime
class CdpBackend implements ICdpBackend {
  private port: number
  private ws: WebSocket | null = null
  private messageId = 0
  private pending = new Map<number, PendingRequest>()
  private connected = false
  private eventHandlers = new Map<string, ((params: unknown) => void)[]>()
  private sessionCache = new Map<string, ProtocolApi>()

  constructor(config: { port: number }) {
    this.port = config.port

    const rawSend: RawSend = (method, params) => this.rawSend(method, params)
    const rawOn: RawOn = (event, handler) => this.rawOn(event, handler)
    Object.assign(this, createProtocolApi(rawSend, rawOn))
  }

  async connect(): Promise<void> {
    const versionResponse = await fetch(
      `http://localhost:${this.port}/json/version`,
    )
    const version = (await versionResponse.json()) as {
      webSocketDebuggerUrl: string
    }
    const wsUrl = version.webSocketDebuggerUrl

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this.connected = true
        resolve()
      }

      this.ws.onerror = (event) => {
        reject(new Error(`CDP WebSocket error: ${event}`))
      }

      this.ws.onclose = () => {
        this.connected = false
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data as string)
      }
    })
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.connected = false
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  session(sessionId: string): ProtocolApi {
    let cached = this.sessionCache.get(sessionId)
    if (!cached) {
      cached = createProtocolApi(
        (method, params) => this.rawSend(method, params, sessionId),
        (event, handler) => this.rawOn(event, handler),
      )
      this.sessionCache.set(sessionId, cached)
    }
    return cached
  }

  async getTargets(): Promise<CdpTarget[]> {
    const result = await this.Target.getTargets()

    return result.targetInfos.map((t) => ({
      id: t.targetId,
      type: t.type,
      title: t.title,
      url: t.url,
      tabId: t.tabId,
      windowId: t.windowId,
    }))
  }

  private async rawSend(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
  ): Promise<unknown> {
    if (!this.ws || !this.connected) {
      throw new Error('CDP not connected')
    }

    const id = ++this.messageId
    const message: Record<string, unknown> = {
      id,
      method,
      params: params ?? {},
    }
    if (sessionId) {
      message.sessionId = sessionId
    }

    const ws = this.ws
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      ws.send(JSON.stringify(message))
    })
  }

  private rawOn(event: string, handler: (params: unknown) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.push(handler)
    }
    return () => {
      const list = this.eventHandlers.get(event)
      if (list) {
        const idx = list.indexOf(handler)
        if (idx !== -1) list.splice(idx, 1)
      }
    }
  }

  private handleMessage(data: string): void {
    const message = JSON.parse(data) as {
      id?: number
      method?: string
      params?: unknown
      result?: unknown
      error?: { message: string; code: number }
    }

    if (message.id !== undefined) {
      const pending = this.pending.get(message.id)
      if (pending) {
        this.pending.delete(message.id)
        if (message.error) {
          pending.reject(new Error(`CDP error: ${message.error.message}`))
        } else {
          pending.resolve(message.result)
        }
      }
    } else if (message.method) {
      const handlers = this.eventHandlers.get(message.method)
      if (handlers) {
        for (const handler of handlers) {
          handler(message.params)
        }
      }
    }
  }
}

export { CdpBackend }
