# Klavis MCP Integration Design

## 1. What Are We Building?

We are building an MCP (Model Context Protocol) integration for the Nxtscape browser agent using Klavis as the third-party service provider. This integration will allow users to:

1. **Connect & Install MCP Servers**: Users can install and connect to various MCP servers (Gmail, YouTube, GitHub, Slack, etc.) through a one-time setup process
2. **Automatic Authentication**: During installation, OAuth authentication is handled automatically for servers that require it
3. **Persistent State**: Klavis maintains server instances and OAuth tokens in the cloud
4. **Seamless Tool Access**: Once installed, the browser agent can automatically discover and use tools from connected MCP servers
5. **Natural Language Commands**: Users can give commands like "check my emails from Gmail" and the agent will automatically use the appropriate MCP server tools

### Key Features:
- **One-time Setup**: Install and authenticate with MCP servers once
- **Cloud-Managed State**: All server instances and auth tokens managed by Klavis
- **Automatic Discovery**: Browser agent automatically detects installed MCP servers
- **Tool Execution**: Direct tool calls to MCP servers through Klavis API
- **Error Handling**: Robust error handling with re-authentication prompts when needed

### User Journey:
1. User opens settings and installs Gmail MCP server
2. OAuth popup appears for Gmail authentication (one-time)
3. Later, user tells agent: "Check my emails from Gmail"
4. Agent automatically uses the installed Gmail MCP server
5. Results are returned to the user

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Browser Extension                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  User: "Check my Gmail emails"                                        │
│                │                                                       │
│                ▼                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    BrowserAgent                                │  │
│  │  - Receives user command                                       │  │
│  │  - Identifies Gmail MCP needed                                 │  │
│  │  - Invokes MCPTool                                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                │                                                       │
│                ▼                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                      MCPTool                                   │  │
│  │  - Similar to FindElementTool pattern                          │  │
│  │  - Actions: getInstalledServers, listTools, executeTool        │  │
│  │  - Returns structured ToolOutput                               │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                │                                                       │
│                ▼                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  KlavisAPIManager                              │  │
│  │  - Manages user ID (browser-specific)                          │  │
│  │  - Server instance lifecycle                                   │  │
│  │  - OAuth authentication flow                                   │  │
│  │  - Tool discovery and execution                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                │                                                       │
│                ▼                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  KlavisAPIClient                               │  │
│  │  - REST API communication                                      │  │
│  │  - Request/response validation with Zod                        │  │
│  │  - Error handling and retries                                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼ HTTPS REST API
                 ┌──────────────────────────────────────┐
                 │           Klavis Cloud                │
                 │  ┌────────────────────────────────┐  │
                 │  │      User Instances            │  │
                 │  │  - userId: nxtscape_123456     │  │
                 │  │  - Gmail Instance (ID, URL)    │  │
                 │  │  - YouTube Instance (ID, URL)  │  │
                 │  │  - OAuth tokens & auth state   │  │
                 │  └────────────────────────────────┘  │
                 │  ┌────────────────────────────────┐  │
                 │  │    MCP Server Hosting         │  │
                 │  │  - gmail-mcp-server.klavis.ai │  │
                 │  │  - youtube-mcp-server.klavis  │  │
                 │  │  - Tool execution endpoints    │  │
                 │  └────────────────────────────────┘  │
                 └──────────────────────────────────────┘
```

### Key Flows:

#### Installation Flow (Admin - Done via UI):
1. User opens settings/integrations UI
2. User clicks "Install Gmail"
3. UI → KlavisAPIManager.installServer('Gmail')
4. KlavisAPIManager → POST /mcp-server/instance/create
5. If OAuth URL returned → Open OAuth popup
6. User completes OAuth → Klavis stores tokens
7. Server instance created and ready for use

#### Runtime Flow (Using Installed Servers):
1. User: "Check my Gmail emails"
2. BrowserAgent determines Gmail tool is needed
3. BrowserAgent → MCPTool.execute({ action: 'getUserInstances' })
4. MCPTool → GET /user/instances (finds Gmail with serverUrl)
5. BrowserAgent → MCPTool.execute({ action: 'listTools', serverUrl: 'gmail-url' })
6. MCPTool → POST /mcp-server/list-tools
7. BrowserAgent → MCPTool.execute({ action: 'callTool', serverUrl: 'gmail-url', toolName: 'list_emails' })
8. MCPTool → POST /mcp-server/call-tool
9. Results returned to user

## 3. High-Level Pseudo Code (Simplified)

### MCPTool (Following FindElementTool Pattern)

```typescript
// src/lib/tools/mcp/MCPTool.ts
import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/Tool.interface"

// Input schema - only runtime operations
const MCPToolInputSchema = z.object({
  action: z.enum(['getUserInstances', 'listTools', 'callTool']),
  serverUrl: z.string().optional(),    // For listTools and callTool
  toolName: z.string().optional(),     // For callTool
  toolArgs: z.any().optional()         // For callTool
})

export class MCPTool {
  constructor(private executionContext: ExecutionContext) {}

  async execute(input: MCPToolInput): Promise<ToolOutput> {
    try {
      // Get manager and API client
      const manager = this.executionContext.getKlavisAPIManager()
      const userId = await manager.getUserId()
      const client = manager.client  // Our custom API client

      switch (input.action) {
        case 'getUserInstances':
          // Get all installed MCP servers for this user
          const instances = await client.getUserInstances(userId, 'Nxtscape')
          return toolSuccess(JSON.stringify({ instances }))

        case 'listTools':
          // List available tools for a specific server
          if (!input.serverUrl) {
            return toolError("serverUrl required for listTools")
          }
          const tools = await client.listTools(input.serverUrl)
          return toolSuccess(JSON.stringify({ tools }))

        case 'callTool':
          // Execute a tool on an MCP server
          if (!input.serverUrl || !input.toolName) {
            return toolError("serverUrl and toolName required for callTool")
          }
          const result = await client.callTool(
            input.serverUrl,
            input.toolName,
            input.toolArgs || {}
          )
          if (!result.success) {
            return toolError(result.error || 'Tool execution failed')
          }
          return toolSuccess(JSON.stringify(result.result))

        default:
          return toolError(`Unknown action: ${input.action}`)
      }
    } catch (error) {
      return toolError(`MCP operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// LangChain wrapper factory function
export function createMCPTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const mcpTool = new MCPTool(executionContext)

  return new DynamicStructuredTool({
    name: "mcp_tool",
    description: "Interact with MCP servers. Actions: getUserInstances, createInstance, listTools, callTool",
    schema: MCPToolInputSchema,
    func: async (args): Promise<string> => {
      const result = await mcpTool.execute(args)
      return JSON.stringify(result)
    }
  })
}
```

### KlavisAPIManager (With Server Installation)

```typescript
// src/lib/mcp/KlavisAPIManager.ts
import { KlavisAPIClient, type CreateServerResponse } from './KlavisAPIClient'

/**
 * Manages MCP servers - handles user ID, OAuth, and server installation
 */
export class KlavisAPIManager {
  private static instance: KlavisAPIManager | null = null
  public readonly client: KlavisAPIClient  // Our minimal API client
  private userId: string | null = null

  private constructor() {
    const apiKey = process.env.KLAVIS_API_KEY
    if (!apiKey) {
      throw new Error("KLAVIS_API_KEY not configured")
    }
    this.client = new KlavisAPIClient(apiKey)
  }

  static getInstance(): KlavisAPIManager {
    if (!KlavisAPIManager.instance) {
      KlavisAPIManager.instance = new KlavisAPIManager()
    }
    return KlavisAPIManager.instance
  }

  // Get or create browser-specific user ID
  async getUserId(): Promise<string> {
    if (this.userId) {
      return this.userId
    }

    const storage = await chrome.storage.local.get(['nxtscape_user_id'])
    if (storage.nxtscape_user_id) {
      this.userId = storage.nxtscape_user_id as string
      return this.userId
    }

    this.userId = `nxtscape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await chrome.storage.local.set({ nxtscape_user_id: this.userId })
    return this.userId
  }

  /**
   * Install a new MCP server (called from UI, not from MCPTool)
   * This is an admin operation done before servers can be used
   */
  async installServer(serverName: string): Promise<CreateServerResponse> {
    const userId = await this.getUserId()
    
    // Create server instance
    const server = await this.client.createServerInstance({
      serverName,
      userId,
      platformName: 'Nxtscape'
    })

    // Handle OAuth if needed
    if (server.oauthUrl) {
      await this.handleOAuth(server.oauthUrl)
    }

    return server
  }

  // Simple OAuth handler
  private async handleOAuth(oauthUrl: string): Promise<void> {
    const tab = await chrome.tabs.create({ url: oauthUrl, active: true })
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        try {
          const updatedTab = await chrome.tabs.get(tab.id!)
          if (updatedTab.url?.includes('callback')) {
            clearInterval(checkInterval)
            await chrome.tabs.remove(tab.id!)
            resolve()
          }
        } catch {
          clearInterval(checkInterval)
          resolve()  // Tab closed = assume success
        }
      }, 1000)

      setTimeout(() => {
        clearInterval(checkInterval)
        chrome.tabs.remove(tab.id!).catch(() => {})
        resolve()  // Timeout = assume success
      }, 5 * 60 * 1000)
    })
  }
}
```

### KlavisAPIClient (Minimal Custom Client - No Zod)

Since the TypeScript SDK is missing critical methods like `getUserInstances`, we'll build a minimal API client with just the 3 methods we need for runtime:

```typescript
// src/lib/mcp/KlavisAPIClient.ts

// Simple type definitions
export interface UserInstance {
  id: string
  name: string
  description: string | null
  tools: Array<{ name: string; description: string }> | null
  authNeeded: boolean
  isAuthenticated: boolean
}

export interface CreateServerResponse {
  serverUrl: string
  instanceId: string
  oauthUrl?: string | null
}

export class KlavisAPIClient {
  private baseUrl = 'https://api.klavis.ai'
  
  constructor(private apiKey: string) {}

  private async request<T>(method: string, path: string, body?: any, query?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`
    if (query) {
      url += '?' + new URLSearchParams(query).toString()
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
      throw new Error(`Klavis API: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  // GET /user/instances
  async getUserInstances(userId: string, platformName: string): Promise<UserInstance[]> {
    const data = await this.request<{ instances: UserInstance[] }>('GET', '/user/instances', undefined, {
      user_id: userId,
      platform_name: platformName
    })
    return data.instances || []
  }

  // POST /mcp-server/instance/create  
  async createServerInstance(params: { serverName: string, userId: string, platformName: string }): Promise<CreateServerResponse> {
    return this.request<CreateServerResponse>('POST', '/mcp-server/instance/create', params)
  }

  // POST /mcp-server/list-tools
  async listTools(serverUrl: string): Promise<any[]> {
    const data = await this.request<any>('POST', '/mcp-server/list-tools', {
      serverUrl,
      format: 'mcp_native',
      connectionType: 'StreamableHttp'
    })
    return data.tools || []
  }

  // POST /mcp-server/call-tool
  async callTool(serverUrl: string, toolName: string, toolArgs: any): Promise<any> {
    return this.request<any>('POST', '/mcp-server/call-tool', {
      serverUrl,
      toolName,
      toolArgs,
      connectionType: 'StreamableHttp'
    })
  }
}
```

### ExecutionContext Integration

```typescript
// src/lib/runtime/ExecutionContext.ts (additions)
import { KlavisAPIManager } from "@/lib/mcp/KlavisAPIManager"

export class ExecutionContext {
  // ... existing code ...

  /**
   * Get KlavisAPIManager singleton
   */
  getKlavisAPIManager(): KlavisAPIManager {
    return KlavisAPIManager.getInstance()
  }
}
```

## Summary of Design Decisions

### Why Custom API Client Instead of SDK

The Klavis TypeScript SDK is missing critical methods like `getUserInstances` that we need. After evaluating options, we decided to build a minimal custom API client because:

1. **Missing Critical Methods**: SDK doesn't have `getUserInstances` which is essential
2. **Consistency**: Better to have one pattern than mix SDK + direct API calls
3. **Simplicity**: Only 80 lines of code for the 4 methods we need
4. **Control**: Full TypeScript types with Zod validation

### Final Architecture

1. **KlavisAPIClient** (~75 lines - No Zod):
   - Simple TypeScript interfaces (no Zod)
   - `getUserInstances()` - GET /user/instances
   - `createServerInstance()` - POST /mcp-server/instance/create
   - `listTools()` - POST /mcp-server/list-tools
   - `callTool()` - POST /mcp-server/call-tool

2. **KlavisAPIManager** (~80 lines):
   - Singleton pattern
   - User ID management (Chrome storage)
   - `installServer()` - Admin operation for server setup
   - OAuth handling (Chrome tabs)
   - Exposes API client for runtime use

3. **MCPTool** (~50 lines - Runtime only):
   - Only runtime operations (no installation)
   - `getUserInstances` - Get installed servers
   - `listTools` - List server tools
   - `callTool` - Execute server tools
   - Returns structured ToolOutput

### Benefits of This Approach

- **Minimal Code**: ~200 lines total
- **Clean Separation**: Admin operations (installServer) separate from runtime (MCPTool)
- **No External Dependencies**: No Zod, no SDK - just fetch API
- **Type Safe**: Simple TypeScript interfaces
- **Simple**: Each class has one clear responsibility

### Key Design Decisions

1. **No Zod**: Simple TypeScript interfaces instead
2. **No SDK**: Custom minimal client due to missing methods
3. **Separation of Concerns**:
   - **Installation**: Via UI → KlavisAPIManager.installServer()
   - **Runtime**: Via MCPTool → only uses already installed servers
4. **Clear Boundaries**: MCPTool can't install servers, only use them

### Dependencies

Environment variable only:
```bash
KLAVIS_API_KEY=your-api-key
```

No npm packages needed!