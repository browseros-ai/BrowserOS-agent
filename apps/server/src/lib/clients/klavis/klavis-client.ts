/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import { EXTERNAL_URLS } from '@browseros/shared/constants/urls'

export interface StrataCreateResponse {
  strataServerUrl: string
  strataId: string
  addedServers: string[]
  oauthUrls?: Record<string, string>
  apiKeyUrls?: Record<string, string>
}

export class KlavisClient {
  private baseUrl: string
  private apiKey?: string

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || EXTERNAL_URLS.KLAVIS_PROXY
    this.apiKey = apiKey
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      TIMEOUTS.KLAVIS_FETCH,
    )

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Klavis error: ${response.status} ${response.statusText} - ${errorText}`,
        )
      }

      return response.json()
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Klavis request timed out after ${TIMEOUTS.KLAVIS_FETCH}ms`,
        )
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Create Strata instance with specified servers
   * Returns strataServerUrl for MCP connection and oauthUrls for authentication
   */
  async createStrata(
    userId: string,
    servers: string[],
  ): Promise<StrataCreateResponse> {
    return this.request<StrataCreateResponse>(
      'POST',
      '/mcp-server/strata/create',
      { userId, servers },
    )
  }

  /**
   * Get user integrations with authentication status
   */
  async getUserIntegrations(
    userId: string,
  ): Promise<Array<{ name: string; isAuthenticated: boolean }>> {
    const data = await this.request<{
      integrations: Array<{ name: string; isAuthenticated: boolean }>
    }>('GET', `/user/${userId}/integrations`)
    return data.integrations || []
  }

  /**
   * Submit an API key to Klavis's set-auth endpoint.
   * Calls api.klavis.ai directly with Bearer auth since this path
   * isn't available through the proxy.
   * Docs: POST /mcp-server/instance/set-auth with { instanceId, authData }
   */
  async submitApiKey(apiKeyUrl: string, apiKey: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Klavis API key required for API key submission')
    }

    const parsedUrl = new URL(apiKeyUrl)
    const instanceId = parsedUrl.searchParams.get('instance_id')
    if (!instanceId) {
      throw new Error('Missing instance_id in apiKeyUrl')
    }

    const baseEndpoint = `${parsedUrl.origin}${parsedUrl.pathname}`

    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      TIMEOUTS.KLAVIS_FETCH,
    )

    try {
      const response = await fetch(baseEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          instanceId,
          authData: { api_key: apiKey },
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Klavis API key submission failed: ${response.status} ${response.statusText} - ${errorText}`,
        )
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Klavis API key submission timed out after ${TIMEOUTS.KLAVIS_FETCH}ms`,
        )
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Remove a server from a Strata instance
   * Flow: createStrata(server) to get strataId → DELETE /strata/{strataId}/servers?servers=X
   */
  async removeServer(userId: string, serverName: string): Promise<void> {
    // createStrata to get strataId (passing same server ensures it exists)
    const strata = await this.createStrata(userId, [serverName])
    await this.request(
      'DELETE',
      `/mcp-server/strata/${strata.strataId}/servers?servers=${encodeURIComponent(serverName)}`,
    )
  }
}
