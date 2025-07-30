import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TabOperationsTool } from './TabOperationsTool'

describe('TabOperationsTool', () => {
  let tool: TabOperationsTool
  let mockExecutionContext: any
  let mockBrowserContext: any

  beforeEach(() => {
    // Mock chrome.tabs API
    global.chrome = {
      tabs: {
        query: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
      windows: {
        getCurrent: vi.fn(),
      }
    } as any

    mockBrowserContext = {
      getCurrentWindow: vi.fn().mockResolvedValue({ id: 1 }),
      openTab: vi.fn(),
      switchTab: vi.fn(),
      closeTab: vi.fn(),
    }

    mockExecutionContext = {
      browserContext: mockBrowserContext,
    }

    tool = new TabOperationsTool(mockExecutionContext)
  })

  it('tests that operations are routed correctly based on action type', async () => {
    // Mock tab data
    const mockTabs = [
      { id: 1, title: 'Google', url: 'https://google.com', active: true, windowId: 1 },
      { id: 2, title: 'GitHub', url: 'https://github.com', active: false, windowId: 1 }
    ]
    vi.mocked(chrome.tabs.query).mockResolvedValue(mockTabs)

    // Test list operation
    const listResult = await tool.execute({ action: 'list' })
    expect(listResult.ok).toBe(true)
    const listOutput = JSON.parse(listResult.output)
    expect(Array.isArray(listOutput)).toBe(true)
    expect(listOutput).toHaveLength(2)
    expect(listOutput[0]).toHaveProperty('id')
    expect(listOutput[0]).toHaveProperty('url')
    expect(listOutput[0]).toHaveProperty('title')
    expect(listOutput[0]).toHaveProperty('windowId')
    expect(chrome.tabs.query).toHaveBeenCalledWith({ windowId: 1 })

    // Test list_all operation
    const listAllResult = await tool.execute({ action: 'list_all' })
    expect(listAllResult.ok).toBe(true)
    const listAllOutput = JSON.parse(listAllResult.output)
    expect(Array.isArray(listAllOutput)).toBe(true)
    expect(listAllOutput).toHaveLength(2)
    expect(chrome.tabs.query).toHaveBeenCalledWith({})

    // Test new tab operation
    mockBrowserContext.openTab.mockResolvedValue({ tabId: 3 })
    const newResult = await tool.execute({ action: 'new' })
    expect(newResult.ok).toBe(true)
    expect(newResult.output).toContain('Created new tab with ID: 3')
    expect(mockBrowserContext.openTab).toHaveBeenCalledWith('chrome://newtab/')
  })

  it('tests that required parameters are validated for operations', async () => {
    // Test switch without tabIds
    const switchResult = await tool.execute({ action: 'switch' })
    expect(switchResult.ok).toBe(false)
    expect(switchResult.output).toContain('Switch operation requires a tab ID')

    // Test close without tabIds
    const closeResult = await tool.execute({ action: 'close' })
    expect(closeResult.ok).toBe(false)
    expect(closeResult.output).toContain('Close operation requires tab IDs')

    // Test switch with valid tabId
    vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 2, title: 'Test Page' } as any)
    mockBrowserContext.switchTab.mockResolvedValue(undefined)
    const validSwitchResult = await tool.execute({ action: 'switch', tabIds: [2] })
    expect(validSwitchResult.ok).toBe(true)
    expect(mockBrowserContext.switchTab).toHaveBeenCalledWith(2)
  })

  it('tests that Chrome API errors are handled gracefully', async () => {
    // Mock Chrome API error for list operation
    vi.mocked(chrome.tabs.query).mockRejectedValue(new Error('Permission denied'))
    const listResult = await tool.execute({ action: 'list' })
    expect(listResult.ok).toBe(false)
    expect(listResult.output).toContain('Failed to list tabs')
    expect(listResult.output).toContain('Permission denied')

    // Mock browserContext error for new tab
    mockBrowserContext.openTab.mockRejectedValue(new Error('Tab limit reached'))
    const newResult = await tool.execute({ action: 'new' })
    expect(newResult.ok).toBe(false)
    expect(newResult.output).toContain('Failed to create new tab')
    expect(newResult.output).toContain('Tab limit reached')

    // Mock error for close operation
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1 }, { id: 2 }] as any)
    mockBrowserContext.closeTab.mockRejectedValue(new Error('Cannot close last tab'))
    const closeResult = await tool.execute({ action: 'close', tabIds: [1] })
    expect(closeResult.ok).toBe(true) // Should still succeed with partial failures
    expect(closeResult.output).toContain('Failed to close')
  })

  it('tests that tab close operations handle partial failures', async () => {
    // Mock existing tabs
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1 }, { id: 2 }, { id: 3 }
    ] as any)

    // Mock closeTab to fail on tab 2 but succeed on others
    mockBrowserContext.closeTab
      .mockResolvedValueOnce(undefined) // tab 1 succeeds
      .mockRejectedValueOnce(new Error('Tab is pinned')) // tab 2 fails
      .mockResolvedValueOnce(undefined) // tab 3 succeeds

    const result = await tool.execute({ action: 'close', tabIds: [1, 2, 3] })
    expect(result.ok).toBe(true)
    expect(result.output).toContain('Closed 2 tab(s)')
    expect(result.output).toContain('Failed to close 1 tab(s)')
    expect(result.output).toContain('Tab is pinned')
  })
})