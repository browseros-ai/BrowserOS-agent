import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import { logger } from '../../lib/logger'
import type { ControllerBackend as IControllerBackend } from './types'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

export class ControllerBackend implements IControllerBackend {
  private wss: WebSocketServer | null = null
  private port: number
  private clients = new Map<string, WebSocket>()
  private primaryClientId: string | null = null
  private requestCounter = 0
  private pendingRequests = new Map<string, PendingRequest>()

  constructor(config: { port: number }) {
    this.port = config.port
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({
        port: this.port,
        host: '127.0.0.1',
      })

      const onListening = () => {
        this.wss?.off('error', onError)
        logger.info(
          `Controller WebSocket server listening on ws://127.0.0.1:${this.port}`,
        )
        resolve()
      }

      const onError = (error: Error) => {
        this.wss?.off('listening', onListening)
        reject(error)
      }

      this.wss.once('listening', onListening)
      this.wss.once('error', onError)

      this.wss.on('connection', (ws: WebSocket) => {
        const clientId = this.registerClient(ws)
        logger.info('Extension connected', { clientId })

        ws.on('message', (data: Buffer) => {
          try {
            const message = data.toString()
            const parsed = JSON.parse(message)

            if (parsed.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong' }))
              return
            }
            if (parsed.type === 'focused') {
              this.handleFocusEvent(clientId)
              return
            }
            if (
              parsed.type === 'register_windows' ||
              parsed.type === 'window_created' ||
              parsed.type === 'window_removed'
            ) {
              // Window ownership messages — ignored for now (multi-profile deferred)
              return
            }

            this.handleResponse(parsed)
          } catch (error) {
            logger.error(`Error parsing message from ${clientId}: ${error}`)
          }
        })

        ws.on('close', () => {
          logger.info('Extension disconnected', { clientId })
          this.handleClientDisconnect(clientId)
        })

        ws.on('error', (error: Error) => {
          logger.error(`WebSocket error for ${clientId}: ${error.message}`)
        })
      })

      this.wss.on('error', (error: Error) => {
        logger.error(`WebSocket server error: ${error.message}`)
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const [id, pending] of this.pendingRequests.entries()) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('ControllerBackend stopping'))
        this.pendingRequests.delete(id)
      }

      for (const ws of this.clients.values()) {
        try {
          ws.close()
        } catch {
          // ignore
        }
      }
      this.clients.clear()
      this.primaryClientId = null

      if (this.wss) {
        this.wss.close(() => {
          logger.info('Controller WebSocket server closed')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  isConnected(): boolean {
    return this.primaryClientId !== null
  }

  async send(
    action: string,
    payload?: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.isConnected()) {
      throw new Error('BrowserOS helper service not connected')
    }

    const client = this.primaryClientId
      ? this.clients.get(this.primaryClientId)
      : null
    if (!client) {
      throw new Error('BrowserOS helper service not connected')
    }

    const id = `${Date.now()}-${++this.requestCounter}`
    const timeoutMs = TIMEOUTS.CONTROLLER_BRIDGE

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request ${action} timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timeout })

      try {
        const message = JSON.stringify({
          id,
          action,
          payload: payload ?? {},
        })
        client.send(message)
      } catch (error) {
        clearTimeout(timeout)
        this.pendingRequests.delete(id)
        reject(error)
      }
    })
  }

  private handleResponse(response: {
    id: string
    ok: boolean
    data?: unknown
    error?: string
  }): void {
    const pending = this.pendingRequests.get(response.id)

    if (!pending) {
      logger.warn(`Received response for unknown request ID: ${response.id}`)
      return
    }

    clearTimeout(pending.timeout)
    this.pendingRequests.delete(response.id)

    if (response.ok) {
      pending.resolve(response.data)
    } else {
      pending.reject(new Error(response.error || 'Unknown error'))
    }
  }

  private registerClient(ws: WebSocket): string {
    const clientId = `client-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
    this.clients.set(clientId, ws)

    if (!this.primaryClientId) {
      this.primaryClientId = clientId
      logger.info('Primary controller assigned', { clientId })
    } else {
      logger.info('Controller connected in standby mode', {
        clientId,
        primaryClientId: this.primaryClientId,
      })
    }

    return clientId
  }

  private handleClientDisconnect(clientId: string): void {
    const wasPrimary = this.primaryClientId === clientId
    this.clients.delete(clientId)

    if (wasPrimary) {
      this.primaryClientId = null

      for (const [id, pending] of this.pendingRequests.entries()) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('Primary connection closed'))
        this.pendingRequests.delete(id)
      }

      this.promoteNextPrimary()
    }
  }

  private promoteNextPrimary(): void {
    const nextEntry = this.clients.keys().next()
    if (nextEntry.done) {
      logger.warn('No controller connections available to promote')
      return
    }

    this.primaryClientId = nextEntry.value
    logger.info('Promoted controller to primary', {
      clientId: this.primaryClientId,
    })
  }

  private handleFocusEvent(clientId: string): void {
    if (this.primaryClientId === clientId) return

    const previousPrimary = this.primaryClientId
    this.primaryClientId = clientId
    logger.info('Primary controller reassigned due to focus event', {
      clientId,
      previousPrimary,
    })
  }
}
