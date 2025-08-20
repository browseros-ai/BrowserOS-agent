import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StorageTool } from './StorageTool'
import { StorageManager } from '@/lib/runtime/StorageManager'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'

// Mock the StorageManager
vi.mock('@/lib/runtime/StorageManager', () => ({
  StorageManager: {
    set: vi.fn(),
    get: vi.fn(),
    clearAll: vi.fn()
  }
}))

describe('StorageTool', () => {
  let storageTool: StorageTool
  let mockExecutionContext: ExecutionContext

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecutionContext = {} as ExecutionContext
    storageTool = new StorageTool(mockExecutionContext)
  })

  it('tests that the tool can store a value', async () => {
    const input = {
      action: 'set' as const,
      key: 'test_key',
      value: { data: 'test_value' }
    }

    vi.mocked(StorageManager.set).mockResolvedValue(undefined)

    const result = await storageTool.execute(input)

    expect(result.ok).toBe(true)
    expect(result.output).toBe('Stored value for key: test_key')
    expect(StorageManager.set).toHaveBeenCalledWith('test_key', { data: 'test_value' })
  })

  it('tests that the tool can retrieve a stored value', async () => {
    const input = {
      action: 'get' as const,
      key: 'test_key',
      value: undefined
    }

    const storedValue = { data: 'test_value' }
    vi.mocked(StorageManager.get).mockResolvedValue(storedValue)

    const result = await storageTool.execute(input)

    expect(result.ok).toBe(true)
    expect(result.output).toBe(JSON.stringify(storedValue))
    expect(StorageManager.get).toHaveBeenCalledWith('test_key')
  })

  it('tests that the tool handles missing values gracefully', async () => {
    const input = {
      action: 'get' as const,
      key: 'missing_key',
      value: undefined
    }

    vi.mocked(StorageManager.get).mockResolvedValue(null)

    const result = await storageTool.execute(input)

    expect(result.ok).toBe(true)
    expect(result.output).toBe('No value found for key: missing_key')
  })

  it('tests that the tool requires a value for set operations', async () => {
    const input = {
      action: 'set' as const,
      key: 'test_key',
      value: undefined
    }

    const result = await storageTool.execute(input)

    expect(result.ok).toBe(false)
    expect(result.output).toBe('Value is required for set operation')
    expect(StorageManager.set).not.toHaveBeenCalled()
  })

  it('tests that the tool handles storage errors gracefully', async () => {
    const input = {
      action: 'set' as const,
      key: 'test_key',
      value: 'test_value'
    }

    vi.mocked(StorageManager.set).mockRejectedValue(new Error('Storage error'))

    const result = await storageTool.execute(input)

    expect(result.ok).toBe(false)
    expect(result.output).toBe('Storage operation failed: Storage error')
  })
})