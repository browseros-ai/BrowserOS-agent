import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { KlavisAPIClient } from './KlavisAPIClient'

// Mock fetch globally
global.fetch = vi.fn()

describe('KlavisAPIClient', () => {
  let client: KlavisAPIClient
  const mockApiKey = 'test-api-key'

  beforeEach(() => {
    vi.clearAllMocks()
    client = new KlavisAPIClient(mockApiKey)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tests that client can be created with API key', () => {
    expect(client).toBeDefined()
  })

  it('tests that client throws error when API key is empty', async () => {
    const emptyClient = new KlavisAPIClient('')
    
    await expect(emptyClient.getUserInstances('user123', 'Nxtscape'))
      .rejects
      .toThrow('Klavis API key not configured')
  })

  it('tests that getUserInstances makes correct API call', async () => {
    const mockResponse = {
      instances: [
        { id: '1', name: 'Gmail', authNeeded: false, isAuthenticated: true }
      ]
    }
    
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })
    
    const result = await client.getUserInstances('user123', 'Nxtscape')
    
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.klavis.ai/user/instances?user_id=user123&platform_name=Nxtscape',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-key'
        })
      })
    )
    
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Gmail')
  })

  it('tests that API errors are handled properly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid API key'
    })
    
    await expect(client.getUserInstances('user123', 'Nxtscape'))
      .rejects
      .toThrow('Klavis API error: 401 Unauthorized')
  })
})