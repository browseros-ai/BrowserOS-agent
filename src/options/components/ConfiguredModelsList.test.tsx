import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConfiguredModelsList } from './ConfiguredModelsList'
import { LLMProvider } from '../types/llm-settings'
import { LLMTestService } from '../services/llm-test-service'

// Mock the LLMTestService
vi.mock('../services/llm-test-service')

describe('ConfiguredModelsList-unit-test', () => {
  const mockProviders: LLMProvider[] = [
    {
      id: 'test-1',
      name: 'Test OpenAI',
      type: 'openai',
      modelId: 'gpt-4',
      isBuiltIn: false,
      isDefault: false,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    },
    {
      id: 'test-2',
      name: 'Test Anthropic',
      type: 'anthropic',
      modelId: 'claude-3-sonnet',
      isBuiltIn: true,
      isDefault: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }
  ]

  const mockOnEditProvider = vi.fn()
  const mockOnDeleteProvider = vi.fn()

  let mockTestService: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockTestService = {
      testProvider: vi.fn(),
      runPerformanceTests: vi.fn(),
      storeTestResults: vi.fn(),
      getStoredResults: vi.fn()
    }
    vi.mocked(LLMTestService.getInstance).mockReturnValue(mockTestService)
  })

  it('tests that component can be created with required props', () => {
    render(
      <ConfiguredModelsList
        providers={mockProviders}
        onEditProvider={mockOnEditProvider}
        onDeleteProvider={mockOnDeleteProvider}
      />
    )

    expect(screen.getByText('Configured Models')).toBeInTheDocument()
    expect(screen.getByText('Test OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Test Anthropic')).toBeInTheDocument()
  })

  it('tests that test button triggers provider testing and state changes', async () => {
    mockTestService.testProvider.mockResolvedValue({
      success: true,
      latency: 500,
      response: 'Hello World',
      timestamp: '2023-01-01T00:00:00Z'
    })
    mockTestService.runPerformanceTests.mockResolvedValue({
      latency: 8.5,
      accuracy: 9.0,
      reliability: 9.5,
      overall: 9.0
    })
    mockTestService.storeTestResults.mockResolvedValue(true)

    render(
      <ConfiguredModelsList
        providers={mockProviders}
        onEditProvider={mockOnEditProvider}
        onDeleteProvider={mockOnDeleteProvider}
      />
    )

    const testButton = screen.getAllByText('Test')[0]
    fireEvent.click(testButton)

    // Verify methods are called
    await waitFor(() => {
      expect(mockTestService.testProvider).toHaveBeenCalledWith(mockProviders[0])
      expect(mockTestService.runPerformanceTests).toHaveBeenCalledWith(mockProviders[0])
    })

    // Verify button text changes to show success
    await waitFor(() => {
      expect(screen.getByText('✓ Tested')).toBeInTheDocument()
    })
  })

  it('tests that test failures are handled gracefully', async () => {
    mockTestService.testProvider.mockRejectedValue(new Error('API key invalid'))

    render(
      <ConfiguredModelsList
        providers={mockProviders}
        onEditProvider={mockOnEditProvider}
        onDeleteProvider={mockOnDeleteProvider}
      />
    )

    const testButton = screen.getAllByText('Test')[0]
    fireEvent.click(testButton)

    // Verify error handling
    await waitFor(() => {
      expect(mockTestService.testProvider).toHaveBeenCalled()
    })

    // Should show retry button after error
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  it('tests that provider actions call correct handlers', () => {
    render(
      <ConfiguredModelsList
        providers={mockProviders}
        onEditProvider={mockOnEditProvider}
        onDeleteProvider={mockOnDeleteProvider}
      />
    )

    // Test edit button
    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])
    expect(mockOnEditProvider).toHaveBeenCalledWith(mockProviders[0])

    // Test delete button (only available for non-built-in providers)
    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0])
    expect(mockOnDeleteProvider).toHaveBeenCalledWith(mockProviders[0].id)
  })
})

describe('ConfiguredModelsList-integration-test', () => {
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'tests that component works with real LLM testing service',
    async () => {
      const realProviders: LLMProvider[] = [{
        id: 'real-test-1',
        name: 'Real Test Provider',
        type: 'openai',
        modelId: 'gpt-3.5-turbo',
        apiKey: process.env.LITELLM_API_KEY,
        isBuiltIn: false,
        isDefault: false,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }]

      const mockOnEditProvider = vi.fn()
      const mockOnDeleteProvider = vi.fn()

      // Don't mock the test service for integration test
      vi.unmock('../services/llm-test-service')

      render(
        <ConfiguredModelsList
          providers={realProviders}
          onEditProvider={mockOnEditProvider}
          onDeleteProvider={mockOnDeleteProvider}
        />
      )

      // Verify component renders
      expect(screen.getByText('Configured Models')).toBeInTheDocument()
      expect(screen.getByText('Real Test Provider')).toBeInTheDocument()

      // Verify test functionality is available
      const testButton = screen.getByText('Test')
      expect(testButton).toBeInTheDocument()
      expect(testButton).not.toBeDisabled()

      console.log('✅ ConfiguredModelsList integration test passed')
    },
    30000
  )
})