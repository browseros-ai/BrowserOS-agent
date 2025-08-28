import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'

/**
 * Handles MCP (Model Context Protocol) related messages:
 * - GET_MCP_SERVERS: Get list of available MCP servers
 * - CONNECT_MCP_SERVER: Connect to an MCP server
 * - DISCONNECT_MCP_SERVER: Disconnect from an MCP server
 * - CALL_MCP_TOOL: Execute an MCP tool
 */
export class MCPHandler {
  private mcpServers: Map<string, any> = new Map()

  /**
   * Handle GET_MCP_SERVERS message
   */
  async handleGetMCPServers(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      // Get list of configured MCP servers
      const servers = Array.from(this.mcpServers.entries()).map(([name, server]) => ({
        name,
        connected: server?.connected || false,
        tools: server?.tools || []
      }))

      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          data: { servers }
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('MCPHandler', `Error getting MCP servers: ${errorMessage}`, 'error')
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }

  /**
   * Handle CONNECT_MCP_SERVER message
   */
  async handleConnectMCPServer(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { serverName, config } = message.payload as any
      
      // TODO: Implement actual MCP server connection
      // For now, just store mock connection
      this.mcpServers.set(serverName, {
        connected: true,
        config,
        tools: []
      })
      
      Logging.log('MCPHandler', `Connected to MCP server: ${serverName}`)
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          message: `Connected to ${serverName}`
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('MCPHandler', `Error connecting to MCP server: ${errorMessage}`, 'error')
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }

  /**
   * Handle DISCONNECT_MCP_SERVER message
   */
  handleDisconnectMCPServer(
    message: PortMessage,
    port: chrome.runtime.Port
  ): void {
    try {
      const { serverName } = message.payload as any
      
      // Remove server from registry
      this.mcpServers.delete(serverName)
      
      Logging.log('MCPHandler', `Disconnected from MCP server: ${serverName}`)
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          message: `Disconnected from ${serverName}`
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('MCPHandler', `Error disconnecting from MCP server: ${errorMessage}`, 'error')
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }

  /**
   * Handle CALL_MCP_TOOL message
   */
  async handleCallMCPTool(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { serverName, toolName, args } = message.payload as any
      
      const server = this.mcpServers.get(serverName)
      if (!server || !server.connected) {
        throw new Error(`MCP server ${serverName} not connected`)
      }
      
      // TODO: Implement actual MCP tool execution
      // For now, return mock result
      const result = {
        success: true,
        output: `Executed ${toolName} on ${serverName}`,
        args
      }
      
      Logging.log('MCPHandler', `Executed MCP tool ${toolName} on ${serverName}`)
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          data: result
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('MCPHandler', `Error calling MCP tool: ${errorMessage}`, 'error')
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }

  /**
   * Get statistics
   */
  getStats(): any {
    return {
      connectedServers: this.mcpServers.size,
      servers: Array.from(this.mcpServers.keys())
    }
  }
}