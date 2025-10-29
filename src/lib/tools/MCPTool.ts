import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/ToolInterface"
import { KlavisAPIManager } from "@/lib/mcp/KlavisAPIManager"
import { MCP_SERVERS } from "@/config/mcpServers"
import { Logging } from "@/lib/utils/Logging"

// Input schema for MCP operations - runtime only
const MCPToolInputSchema = z.object({
  action: z.enum(['getUserInstances', 'listTools', 'callTool']).describe('The action to perform'),
  instanceId: z.string().optional().describe('Instance ID for listTools and callTool'),
  toolName: z.string().optional().describe('Tool name for callTool'),
  toolArgs: z.any().optional().describe('Arguments for callTool')
})

export type MCPToolInput = z.infer<typeof MCPToolInputSchema>

/**
 * MCPTool - Interacts with installed MCP servers at runtime
 * Following the FindElementTool pattern
 */
export class MCPToolImpl {
  private manager: KlavisAPIManager
  private instancesCache: Map<string, { id: string; name: string }> = new Map()

  constructor(private executionContext: ExecutionContext) {
    this.manager = this.executionContext.getKlavisAPIManager()
  }

  /**
   * Get server subdomain from instance name using config mapping
   */
  private _getSubdomainFromName(instanceName: string): string {
    // Look up subdomain from config
    const config = MCP_SERVERS.find(s => s.name === instanceName)
    if (config?.subdomain) {
      return config.subdomain
    }
    // Fallback: derive from name for unknown servers
    return instanceName.toLowerCase().replace(/\s+/g, '')
  }

  async execute(input: MCPToolInput): Promise<ToolOutput> {
    try {
      switch (input.action) {
        case 'getUserInstances':
          return await this._getUserInstances()
        
        case 'listTools':
          return await this._listTools(input.instanceId)
        
        case 'callTool':
          return await this._callTool(input.instanceId, input.toolName, input.toolArgs)
        
        default:
          return toolError(`Unknown action: ${input.action}`)
      }
    } catch (error) {
      return toolError(`MCP operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get all installed MCP servers for the current user
   */
  private async _getUserInstances(): Promise<ToolOutput> {
    try {
      const instances = await this.manager.getInstalledServers()
      
      if (instances.length === 0) {
        return toolSuccess(JSON.stringify({
          instances: [],
          message: 'No MCP servers installed. Please install servers in Settings > Integrations.'
        }))
      }

      // Store instances in cache for later use
      instances.forEach(instance => {
        this.instancesCache.set(instance.id, { id: instance.id, name: instance.name })
      })
      
      // Format instances for easy consumption
      const formattedInstances = instances.map(instance => ({
        id: instance.id,
        name: instance.name,
        authenticated: instance.isAuthenticated,
        authNeeded: instance.authNeeded,
        toolCount: instance.tools?.length || 0
      }))

      return toolSuccess(JSON.stringify({
        instances: formattedInstances,
        count: formattedInstances.length
      }))
    } catch (error) {
      return toolError(`Failed to get user instances: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * List available tools for a specific MCP server
   */
  private async _listTools(instanceId?: string): Promise<ToolOutput> {
    if (!instanceId) {
      return toolError('instanceId is required for listTools action')
    }

    // Get instance details from cache
    const instance = this.instancesCache.get(instanceId)
    if (!instance) {
      return toolError(`Instance ${instanceId} not found. Please run getUserInstances first.`)
    }

    try {
      // Get subdomain from config mapping
      const subdomain = this._getSubdomainFromName(instance.name)
      const tools = await this.manager.client.listTools(instanceId, subdomain)
      
      if (!tools || tools.length === 0) {
        return toolSuccess(JSON.stringify({
          tools: [],
          message: 'No tools available for this server'
        }))
      }

      // Return raw tools from Klavis without formatting
      return toolSuccess(JSON.stringify({
        tools: tools,
        count: tools.length,
        instanceId
      }))
    } catch (error) {
      return toolError(`Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute a tool on an MCP server
   */
  private async _callTool(
    instanceId?: string,
    toolName?: string,
    toolArgs?: any
  ): Promise<ToolOutput> {
    // Validate required parameters
    if (!instanceId) {
      return toolError('instanceId is required for callTool action')
    }
    if (!toolName) {
      return toolError('toolName is required for callTool action')
    }
    
    // Get instance details from cache
    const instance = this.instancesCache.get(instanceId)
    if (!instance) {
      return toolError(`Instance ${instanceId} not found. Please run getUserInstances first.`)
    }

    try {
      // Get subdomain from config mapping
      const subdomain = this._getSubdomainFromName(instance.name)
      
      // Parse toolArgs if it's a string
      let parsedArgs = toolArgs
      if (typeof toolArgs === 'string') {
        try {
          parsedArgs = JSON.parse(toolArgs)
        } catch (e) {
          // If parsing fails, use as-is
          parsedArgs = toolArgs
        }
      }
      
      // Log metric for MCP tool call
      Logging.logMetric('mcp_tool_called', {
        server_name: instance.name,
        tool_name: toolName,
        instance_id: instanceId
      })
      
      // Call the tool
      const result = await this.manager.client.callTool(
        instanceId,
        subdomain,
        toolName,
        parsedArgs || {}
      )

      if (!result.success) {
        // Log metric for tool failure
        Logging.logMetric('mcp_tool_failed', {
          server_name: instance.name,
          tool_name: toolName,
          error: result.error || 'Tool execution failed',
          instance_id: instanceId
        })
        return toolError(result.error || 'Tool execution failed')
      }

      // Log metric for tool success with 10% sampling
      Logging.logMetric('mcp_tool_success', {
        server_name: instance.name,
        tool_name: toolName,
        instance_id: instanceId
      }, 0.1)

      // Format successful result
      const output = {
        success: true,
        toolName,
        result: result.result?.content || result.result,
        instanceId
      }

      return toolSuccess(JSON.stringify(output))
    } catch (error) {
      // Log metric for tool failure
      Logging.logMetric('mcp_tool_failed', {
        server_name: instance.name,
        tool_name: toolName,
        error: error instanceof Error ? error.message : 'Unknown error',
        instance_id: instanceId
      })
      return toolError(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

/**
 * Factory function to create MCPTool for LangChain integration
 */
export function MCPTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const tool = new MCPToolImpl(executionContext)

  return new DynamicStructuredTool({
    name: "mcp_tool",
    description: `Interact with installed MCP servers (Gmail, GitHub, Slack, etc.). 
    Actions:
    - getUserInstances: Get all installed MCP servers with their instance IDs
    - listTools: List available tools for a server (requires instanceId)
    - callTool: Execute a tool on a server (requires instanceId, toolName, toolArgs)`,

    schema: MCPToolInputSchema,
    func: async (args): Promise<string> => {
      const result = await tool.execute(args)
      return JSON.stringify(result)
    }
  })
}