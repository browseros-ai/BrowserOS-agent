import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { KlavisAPIManager } from '@/lib/mcp/KlavisAPIManager'
import { MCP_SERVERS } from '@/config/mcpServers'

/**
 * Handles MCP (Model Context Protocol) related messages:
 * - GET_MCP_SERVERS: Get list of available MCP servers
 * - CONNECT_MCP_SERVER: Connect to an MCP server
 * - DISCONNECT_MCP_SERVER: Disconnect from an MCP server
 * - CALL_MCP_TOOL: Execute an MCP tool
 * - MCP_INSTALL_SERVER: Install an MCP server
 * - MCP_DELETE_SERVER: Delete an MCP server
 * - MCP_GET_INSTALLED_SERVERS: Get installed servers
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
   * Handle MCP_INSTALL_SERVER message
   */
  async handleInstallServer(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    const { serverId } = message.payload as any
    
    Logging.log('MCPHandler', `MCP server installation requested: ${serverId}`)
    
    try {
      // Get the server name from config
      const serverConfig = MCP_SERVERS.find(s => s.id === serverId)
      if (!serverConfig) {
        throw new Error(`Unknown server ID: ${serverId}`)
      }
      
      // Install the server using KlavisAPIManager
      const manager = KlavisAPIManager.getInstance()
      const result = await manager.installServer(serverConfig.name)
      
      // Check if authentication was successful
      if (result.oauthUrl && !result.authSuccess) {
        // OAuth was required but failed
        port.postMessage({
          type: MessageType.MCP_SERVER_STATUS,
          payload: {
            serverId,
            status: 'auth_failed',
            serverUrl: result.serverUrl,
            instanceId: result.instanceId,
            error: 'Authentication required but not completed. Please try installing again and complete the authentication.'
          },
          id: message.id
        })
        
        Logging.log('MCPHandler', `MCP server installed but auth failed: ${serverId} (${result.instanceId})`)
        return
      }
      
      // Send success message
      port.postMessage({
        type: MessageType.MCP_SERVER_STATUS,
        payload: {
          serverId,
          status: 'success',
          serverUrl: result.serverUrl,
          instanceId: result.instanceId,
          authenticated: result.authSuccess !== false
        },
        id: message.id
      })
      
      // Log metric for successful MCP server connection
      Logging.logMetric('mcp_server_connected', {
        server_name: serverConfig.name,
        server_id: serverId,
        instance_id: result.instanceId,
        authenticated: result.authSuccess !== false
      })
      
      Logging.log('MCPHandler', `MCP server installed successfully: ${serverId} (${result.instanceId}), authenticated: ${result.authSuccess !== false}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Installation failed'
      
      // Send error message
      port.postMessage({
        type: MessageType.MCP_SERVER_STATUS,
        payload: {
          serverId,
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
      
      Logging.log('MCPHandler', `MCP server installation failed: ${serverId} - ${errorMessage}`, 'error')
    }
  }

  /**
   * Handle MCP_DELETE_SERVER message
   */
  async handleDeleteServer(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    const { instanceId } = message.payload as any
    
    Logging.log('MCPHandler', `MCP server deletion requested: ${instanceId}`)
    
    try {
      const manager = KlavisAPIManager.getInstance()
      const success = await manager.deleteServer(instanceId)
      
      if (success) {
        port.postMessage({
          type: MessageType.MCP_SERVER_STATUS,
          payload: {
            status: 'deleted',
            instanceId,
            message: 'Server deleted successfully'
          },
          id: message.id
        })
        
        // Log metric for MCP server disconnection
        Logging.logMetric('mcp_server_disconnected', {
          instance_id: instanceId
        })
        
        Logging.log('MCPHandler', `MCP server deleted successfully: ${instanceId}`)
      } else {
        throw new Error('Failed to delete server')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deletion failed'
      
      port.postMessage({
        type: MessageType.MCP_SERVER_STATUS,
        payload: {
          status: 'error',
          instanceId,
          error: errorMessage
        },
        id: message.id
      })
      
      Logging.log('MCPHandler', `MCP server deletion failed: ${instanceId} - ${errorMessage}`, 'error')
    }
  }

  /**
   * Handle MCP_GET_INSTALLED_SERVERS message
   */
  async handleGetInstalledServers(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    Logging.log('MCPHandler', 'Getting installed MCP servers')
    
    try {
      const manager = KlavisAPIManager.getInstance()
      const installedServers = await manager.getInstalledServers()
      
      // Map server data with config icons
      const serversWithConfig = installedServers.map(server => {
        const config = MCP_SERVERS.find(s => s.name === server.name)
        return {
          id: server.id,
          name: server.name,
          description: server.description,
          authenticated: server.isAuthenticated,
          authNeeded: server.authNeeded,
          iconPath: config?.iconPath || null,
          toolCount: server.tools?.length || 0
        }
      })
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'success',
          data: {
            servers: serversWithConfig
          }
        },
        id: message.id
      })
      
      Logging.log('MCPHandler', `Found ${serversWithConfig.length} installed MCP servers`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get installed servers'
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
      
      Logging.log('MCPHandler', `Error getting installed MCP servers: ${errorMessage}`, 'error')
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