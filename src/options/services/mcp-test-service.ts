import { MCPTestResult } from '../types/mcp-settings'
import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'

export async function testMCPServer(serverUrl: string): Promise<MCPTestResult> {
  const service = MCPTestService.getInstance()
  return service.testServer(serverUrl)
}

export class MCPTestService {
  private static instance: MCPTestService

  static getInstance(): MCPTestService {
    if (!MCPTestService.instance) {
      MCPTestService.instance = new MCPTestService()
    }
    return MCPTestService.instance
  }

  async testServer(serverUrl: string): Promise<MCPTestResult> {
    return new Promise((resolve) => {
      let port: chrome.runtime.Port | null = null
      let isPortConnected = false
      const messageId = `mcp-test-${Date.now()}`
      let timeoutTimer: number | null = null

      const cleanup = () => {
        if (timeoutTimer !== null) {
          window.clearTimeout(timeoutTimer)
          timeoutTimer = null
        }
        if (port && isPortConnected) {
          try {
            port.onMessage.removeListener(listener)
            port.onDisconnect.removeListener(disconnectListener)
            port.disconnect()
          } catch (e) {
            // Port might already be disconnected, ignore
          }
        }
        isPortConnected = false
        port = null
      }

      const listener = (msg: PortMessage) => {
        if (msg.id === messageId && msg.type === MessageType.SETTINGS_TEST_MCP_RESPONSE) {
          cleanup()
          const payload = msg.payload as any

          resolve({
            status: payload.success ? 'success' : 'error',
            error: payload.error,
            timestamp: payload.timestamp,
            toolCount: payload.toolCount,
            tools: payload.tools
          })
        } else if (msg.id === messageId && msg.type === MessageType.ERROR) {
          cleanup()
          const payload = msg.payload as any
          resolve({
            status: 'error',
            error: payload.error || 'Unknown error',
            timestamp: new Date().toISOString()
          })
        }
      }

      const disconnectListener = () => {
        isPortConnected = false
        cleanup()
        resolve({
          status: 'error',
          error: 'Connection to background script lost',
          timestamp: new Date().toISOString()
        })
      }

      try {
        port = chrome.runtime.connect({ name: 'options' })
        isPortConnected = true

        port.onMessage.addListener(listener)
        port.onDisconnect.addListener(disconnectListener)

        port.postMessage({
          type: MessageType.SETTINGS_TEST_MCP,
          payload: { serverUrl },
          id: messageId
        })

        timeoutTimer = window.setTimeout(() => {
          cleanup()
          resolve({
            status: 'error',
            error: 'Test timeout after 10 seconds',
            timestamp: new Date().toISOString()
          })
        }, 10000)
      } catch (error) {
        cleanup()
        resolve({
          status: 'error',
          error: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString()
        })
      }
    })
  }
}
