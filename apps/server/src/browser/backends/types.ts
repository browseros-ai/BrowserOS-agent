export interface CdpBackend {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  send(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
  ): Promise<unknown>
  getTargets(): Promise<CdpTarget[]>
  on(event: string, handler: (params: unknown) => void): () => void
}

export interface ControllerBackend {
  start(): Promise<void>
  stop(): Promise<void>
  isConnected(): boolean
  send(action: string, payload?: Record<string, unknown>): Promise<unknown>
}

export interface CdpTarget {
  id: string
  type: string
  title: string
  url: string
  tabId?: number
  windowId?: number
}
