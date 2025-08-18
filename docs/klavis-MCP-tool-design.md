# Klavis MCP (Model Context Protocol) Integration Design

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Integration](#api-integration)
4. [Core Components](#core-components)
5. [Authentication Strategy](#authentication-strategy)
6. [Tool Discovery](#tool-discovery)
7. [Implementation Plan](#implementation-plan)
8. [Usage Examples](#usage-examples)
9. [Error Handling](#error-handling)
10. [Future Considerations](#future-considerations)

## Overview

This document outlines the design for integrating Klavis MCP (Model Context Protocol) servers into the Nxtscape Chrome extension using the Klavis REST API. The integration allows our AI agents to interact with external services like YouTube, Gmail, GitHub, etc., through a unified interface. All MCP-related components will be organized under the `src/lib/tools/mcp/` directory to maintain consistency with the existing tool structure.

### Goals
- **API-First Approach**: Use Klavis REST API directly instead of SDK
- **Cloud-Managed State**: Leverage Klavis cloud for all server state management
- **User Isolation**: Support multiple users with browser-specific IDs
- **Seamless Integration**: MCP tools should work like native Nxtscape tools
- **Type Safety**: Full TypeScript support with Zod validation
- **Progressive Enhancement**: Start simple, add complexity incrementally

### Non-Goals
- Building our own MCP server implementation
- Caching server instances locally
- Modifying the core agent architecture
- Creating UI for MCP server management (initially)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Chrome Extension Context                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐ │
│  │ ProductivityAgent │ ──▶│   ToolRegistry   │ ──▶│  YouTubeTool  │ │
│  └─────────────────┘     └──────────────────┘     └──────────────┘ │
│                                                            │         │
│                                                            ▼         │
│                          ┌─────────────────────────────────────────┐│
│                          │       NxtscapeTool (Base Class)         ││
│                          │  - Standard tool interface              ││
│                          │  - Built-in LLM access                  ││
│                          └─────────────────────────────────────────┘│
│                                          │                           │
│                                          ▼                           │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    MCPToolManager (Singleton)                    ││
│  │  - User ID management (browser-specific)                        ││
│  │  - API client for Klavis REST endpoints                         ││
│  │  - OAuth flow handling                                          ││
│  │  - Tool execution proxy                                         ││
│  │  - No local caching (state in Klavis cloud)                    ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                          │                           │
│                                          ▼                           │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Chrome Storage API                            ││
│  │  - Store browser-specific user ID only                          ││
│  │  - No server instance caching                                   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
└───────────────────────────────────│─────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │   Klavis REST API     │
                        │  - Create MCP servers │
                        │  - Get user instances│
                        │  - List tools         │
                        │  - Execute tools      │
                        │  - Manage auth state  │
                        └───────────────────────┘
```

### Data Flow

1. **User Request**: "Summarize this YouTube video: [URL]"
2. **Agent Selection**: ProductivityAgent identifies YouTubeTool as appropriate
3. **Tool Execution**: YouTubeTool.execute() called with action and params
4. **User ID**: MCPToolManager retrieves/creates browser-specific user ID
5. **Server Lookup**: GET /user/instances to find existing servers for user
6. **Server Creation**: If no server exists, POST /mcp-server/instance/create
7. **Authentication**: If oauthUrl returned, immediately handle OAuth flow
8. **Tool Discovery**: POST /mcp-server/list-tools to get available tools
9. **Tool Execution**: POST /mcp-server/call-tool to execute the tool
10. **Response**: Formatted result returned to user

## API Integration

### Klavis REST API Overview

**Base URL**: `https://api.klavis.ai`

**Authentication**: Bearer token using API key
```typescript
headers: {
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json'
}
```

### Key API Endpoints

#### 1. User Instance Management
```typescript
// Get all server instances for a user
GET /user/instances
// Returns: Array of server instances with serverUrl, instanceId, serverType, etc.
```

#### 2. Server Instance Operations
```typescript
// Create new server instance
POST /mcp-server/instance/create
{
  serverName: Klavis.McpServerName, // e.g., 'youtube', 'gmail'
  userId: string,                   // Browser-specific user ID
  platformName: "Nxtscape"
}
// Returns: { serverUrl, instanceId, oauthUrl? }

// Get specific instance
GET /mcp-server/instance/get/{instance_id}

// Delete instance
DELETE /mcp-server/instance/delete/{instance_id}
```

#### 3. Tool Operations
```typescript
// List available tools for a server
POST /mcp-server/list-tools
{
  serverUrl: string,
  format: "openai" | "anthropic" | "gemini" | "mcp_native"
}

// Execute a tool
POST /mcp-server/call-tool
{
  serverUrl: string,
  toolName: string,
  toolArgs: object,
  connectionType: "StreamableHttp" | "SSE"
}
```

### User Management Strategy

Each browser instance gets a unique user ID stored in Chrome local storage:

```typescript
// Generate/retrieve user ID
async function getUserId(): Promise<string> {
  const storage = await chrome.storage.local.get(['nxtscape_user_id']);
  if (storage.nxtscape_user_id) {
    return storage.nxtscape_user_id;
  }
  
  const userId = `nxtscape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await chrome.storage.local.set({ nxtscape_user_id: userId });
  return userId;
}
```

### API Client Implementation

```typescript
class KlavisAPIClient {
  private baseUrl = 'https://api.klavis.ai';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Klavis API error: ${response.statusText}`);
    }

    return response.json();
  }

  // API methods
  async getUserInstances(userId: string) {
    return this.request('GET', `/user/instances`);
  }

  async createServerInstance(params: CreateServerParams) {
    return this.request('POST', '/mcp-server/instance/create', params);
  }

  async listTools(serverUrl: string) {
    return this.request('POST', '/mcp-server/list-tools', {
      serverUrl,
      format: 'openai'
    });
  }

  async callTool(params: CallToolParams) {
    return this.request('POST', '/mcp-server/call-tool', {
      ...params,
      connectionType: 'StreamableHttp'
    });
  }
}
```

## API Key Management

### Configuration Strategy

The Klavis API key is managed through environment variables and injected at build time:

```javascript
// webpack.config.js
new webpack.DefinePlugin({
  'process.env.KLAVIS_API_KEY': JSON.stringify(process.env.KLAVIS_API_KEY),
  // Other environment variables...
})
```

### Usage Pattern

```typescript
// In tool implementations
const apiKey = process.env.KLAVIS_API_KEY
if (!apiKey) {
  console.warn('⚠️ KLAVIS_API_KEY not found, MCP tools will be unavailable')
  return []
}

const klavisClient = new KlavisClient({ apiKey })
```

### Development Setup

1. Create a `.env` file in the project root:
```bash
KLAVIS_API_KEY=your_api_key_here
```

2. The webpack build process will inject this at compile time
3. MCP tools gracefully degrade when the key is missing

## Core Components

### 1. MCPToolManager (Singleton Service)

**Purpose**: Centralized service for managing MCP server instances using Klavis REST API. All server state is managed in Klavis cloud.

```typescript
// Location: src/lib/tools/mcp/MCPToolManager.ts

class MCPToolManager {
  private static instance: MCPToolManager
  private apiClient: KlavisAPIClient | null = null
  
  // Singleton pattern
  static getInstance(): MCPToolManager
  
  // User management
  async getUserId(): Promise<string>
  
  // Server management (no local caching)
  async getUserServers(userId: string): Promise<ServerInstance[]>
  async getOrCreateServer(userId: string, serverType: string): Promise<ServerInstance>
  async createServer(userId: string, serverType: string): Promise<ServerInstance>
  
  // Tool operations
  async listServerTools(serverUrl: string): Promise<ToolInfo[]>
  async executeServerTool(serverUrl: string, toolName: string, toolArgs: any): Promise<any>
  
  // OAuth handling
  async handleOAuthAuthentication(serverInstance: ServerInstance): Promise<void>
  private async waitForOAuthCompletion(tabId: number): Promise<void>
  
  // Utility methods
  private getServerName(serverType: string): string
  private initializeClient(): KlavisAPIClient
}
```

**Key Responsibilities**:
- Manages browser-specific user IDs
- Communicates with Klavis REST API
- Handles OAuth authentication flows
- No local caching - all state in Klavis cloud
- Executes tools via Klavis API
loud infrastructure for all state management.
