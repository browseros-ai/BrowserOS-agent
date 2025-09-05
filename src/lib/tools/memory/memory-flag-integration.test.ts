import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getMemoryConfig } from '@/lib/memory/config'
import { initializeMemorySystem } from '@/lib/memory/index'

describe('Memory Flag Integration Test', () => {
  let originalMemoryEnabled: string | undefined
  let originalMem0ApiKey: string | undefined

  beforeEach(() => {
    originalMemoryEnabled = process.env.MEMORY_ENABLED
    originalMem0ApiKey = process.env.MEM0_API_KEY
  })

  afterEach(() => {
    if (originalMemoryEnabled !== undefined) {
      process.env.MEMORY_ENABLED = originalMemoryEnabled
    } else {
      delete process.env.MEMORY_ENABLED
    }

    if (originalMem0ApiKey !== undefined) {
      process.env.MEM0_API_KEY = originalMem0ApiKey
    } else {
      delete process.env.MEM0_API_KEY
    }
  })

  it('should respect MEMORY_ENABLED=false and return null MemoryManager using initializeMemorySystem', async () => {
    process.env.MEMORY_ENABLED = 'false'
    process.env.MEM0_API_KEY = 'test-key'

    const config = getMemoryConfig()
    expect(config.enabled).toBe(false)

    const memoryManager = await initializeMemorySystem('test-key', 'test-agent')
    expect(memoryManager).toBeNull()
  })

  it('should respect MEMORY_ENABLED=true but return null without API key', async () => {
    process.env.MEMORY_ENABLED = 'true'
    delete process.env.MEM0_API_KEY

    const config = getMemoryConfig()
    expect(config.enabled).toBe(true)
    expect(config.apiKey).toBeUndefined()

    const memoryManager = await initializeMemorySystem(undefined, 'test-agent')
    expect(memoryManager).toBeNull()
  })

  it('should default to enabled when MEMORY_ENABLED is not set', () => {
    delete process.env.MEMORY_ENABLED
    
    const config = getMemoryConfig()
    expect(config.enabled).toBe(true) // Should use DEFAULT_MEMORY_CONFIG.enabled
  })


  it('should return null when no API key is provided and memory is enabled', async () => {
    process.env.MEMORY_ENABLED = 'true'
    delete process.env.MEM0_API_KEY

    const memoryManager = await initializeMemorySystem()
    expect(memoryManager).toBeNull()
  })

})
