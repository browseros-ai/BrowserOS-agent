/**
 * Manages MCP servers - handles user ID, OAuth, and server installation
 * Singleton pattern ensures one instance across the extension
 */

import { KlavisAPIClient, type CreateServerResponse, type UserInstance } from './KlavisAPIClient'

const NXTSCAPE_USER_ID_KEY = 'nxtscape_user_id'
const PLATFORM_NAME = 'Nxtscape'

export class KlavisAPIManager {
  private static instance: KlavisAPIManager | null = null
  public readonly client: KlavisAPIClient  // Expose client for direct access
  private userId: string | null = null

  private constructor() {
    // Get API key from environment
    const apiKey = process.env.KLAVIS_API_KEY
    if (!apiKey) {
      console.warn('KLAVIS_API_KEY not configured. MCP features will be disabled.')
      // Create client with empty key - operations will fail with clear error
      this.client = new KlavisAPIClient('')
    } else {
      this.client = new KlavisAPIClient(apiKey)
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): KlavisAPIManager {
    if (!KlavisAPIManager.instance) {
      KlavisAPIManager.instance = new KlavisAPIManager()
    }
    return KlavisAPIManager.instance
  }

  /**
   * Get or create browser-specific user ID
   * Format: nxtscape_<timestamp>_<random>
   */
  async getUserId(): Promise<string> {
    // Return cached user ID if available
    if (this.userId) {
      return this.userId
    }

    // Try to get from Chrome storage
    try {
      const storage = await chrome.storage.local.get([NXTSCAPE_USER_ID_KEY])
      if (storage[NXTSCAPE_USER_ID_KEY]) {
        this.userId = storage[NXTSCAPE_USER_ID_KEY] as string
        return this.userId
      }
    } catch (error) {
      console.warn('Could not read from Chrome storage:', error)
    }

    // Generate new user ID
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    this.userId = `nxtscape_${timestamp}_${random}`
    
    // Save to Chrome storage
    try {
      await chrome.storage.local.set({ [NXTSCAPE_USER_ID_KEY]: this.userId })
    } catch (error) {
      console.warn('Could not save to Chrome storage:', error)
    }
    
    return this.userId
  }

  /**
   * Install a new MCP server (called from UI, not from MCPTool)
   * This is an admin operation done before servers can be used
   */
  async installServer(serverName: string): Promise<CreateServerResponse & { authSuccess?: boolean }> {
    const userId = await this.getUserId()
    
    // Create server instance
    const server = await this.client.createServerInstance({
      serverName,
      userId,
      platformName: PLATFORM_NAME
    })

    // Handle OAuth if needed
    let authSuccess = true
    if (server.oauthUrl) {
      authSuccess = await this._handleOAuth(server.oauthUrl, server.instanceId)
    }

    return {
      ...server,
      authSuccess
    }
  }

  /**
   * Get all installed MCP servers for the current user
   */
  async getInstalledServers(): Promise<UserInstance[]> {
    const userId = await this.getUserId()
    return this.client.getUserInstances(userId, PLATFORM_NAME)
  }

  /**
   * Delete an MCP server instance
   */
  async deleteServer(instanceId: string): Promise<boolean> {
    const result = await this.client.deleteServerInstance(instanceId)
    return result.success
  }

  /**
   * Get all available MCP servers (not installed, just available)
   */
  async getAvailableServers() {
    return this.client.getAllServers()
  }

  /**
   * Handle OAuth authentication flow
   * Opens a new tab for OAuth and polls authentication status
   */
  private async _handleOAuth(oauthUrl: string, instanceId: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Open OAuth URL in new tab
      chrome.tabs.create({ url: oauthUrl, active: true }, (tab) => {
        if (!tab.id) {
          console.error('Failed to create OAuth tab')
          resolve(false)
          return
        }

        const tabId = tab.id
        let pollInterval: NodeJS.Timeout
        let timeoutId: NodeJS.Timeout
        let tabClosed = false
        
        // Monitor if user closes the tab manually
        const tabRemovedListener = (removedTabId: number) => {
          if (removedTabId === tabId) {
            tabClosed = true
            clearInterval(pollInterval)
            clearTimeout(timeoutId)
            chrome.tabs.onRemoved.removeListener(tabRemovedListener)
            console.log('OAuth tab closed by user')
            resolve(false)  // User cancelled
          }
        }
        chrome.tabs.onRemoved.addListener(tabRemovedListener)
        
        // Wait 3 seconds before starting to poll (let OAuth page load)
        setTimeout(() => {
          if (tabClosed) return
          
          // Poll authentication status every 2 seconds
          pollInterval = setInterval(async () => {
            try {
              // Check if authenticated using Klavis API
              const authData = await this.client.getAuthMetadata(instanceId)
              
              if (authData.success && authData.authData) {
                // Success! Authentication completed
                clearInterval(pollInterval)
                clearTimeout(timeoutId)
                chrome.tabs.onRemoved.removeListener(tabRemovedListener)
                
                // Close the OAuth tab
                await chrome.tabs.remove(tabId).catch(() => {})
                
                console.log(`OAuth completed successfully for instance ${instanceId}`)
                resolve(true)
              }
            } catch (error) {
              // Not authenticated yet or API error, keep polling
              console.debug('Auth check failed, continuing to poll:', error)
            }
          }, 2000)  // Poll every 2 seconds
          
          // Timeout after 5 minutes
          timeoutId = setTimeout(() => {
            clearInterval(pollInterval)
            chrome.tabs.onRemoved.removeListener(tabRemovedListener)
            chrome.tabs.remove(tabId).catch(() => {})
            console.warn('OAuth timeout after 5 minutes')
            resolve(false)  // Timeout - auth failed
          }, 5 * 60 * 1000)
        }, 3000)  // Initial 3 second delay
      })
    })
  }

  /**
   * Check if a server is installed and authenticated
   */
  async isServerReady(serverName: string): Promise<{
    installed: boolean
    authenticated: boolean
    serverUrl?: string
  }> {
    const servers = await this.getInstalledServers()
    const server = servers.find(s => 
      s.name.toLowerCase() === serverName.toLowerCase()
    )
    
    if (!server) {
      return { installed: false, authenticated: false }
    }
    
    return {
      installed: true,
      authenticated: server.isAuthenticated,
      serverUrl: server.serverUrl
    }
  }
}