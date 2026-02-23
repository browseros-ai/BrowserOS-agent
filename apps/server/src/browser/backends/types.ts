import type { ProtocolApi } from '@browseros/cdp-protocol/protocol-api'

export interface CdpBackend extends ProtocolApi {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  getTargets(): Promise<CdpTarget[]>
  session(sessionId: string): ProtocolApi
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
