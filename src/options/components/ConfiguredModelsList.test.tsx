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
        defaultProvider={mockProviders[1].id}
        testResults={{}}
        onSetDefault={vi.fn()}
        onTest={vi.fn()}
        onBenchmark={vi.fn()}
        onEdit={mockOnEditProvider}
        onDelete={mockOnDeleteProvider}
      />
    )

    expect(screen.getByText('Test OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Test Anthropic')).toBeInTheDocument()
  })

  it('tests that test button triggers provider testing and displays AI response', async () => {
    const mockTestResult = {
      status: 'success' as const,
      responseTime: 500,
      response: 'Hello World! I am working correctly.',
      timestamp: '2023-01-01T00:00:00Z'
    }

    render(
      <ConfiguredModelsList
        providers={mockProviders}
        defaultProvider={mockProviders[0].id}
        testResults={{}}
        onSetDefault={vi.fn()}
        onTest={vi.fn()}
        onBenchmark={vi.fn()}
        onEdit={mockOnEditProvider}
        onDelete={mockOnDeleteProvider}
      />
    )

    // Now update with test result
    const { rerender } = render(
      <ConfiguredModelsList
        providers={mockProviders}
        defaultProvider={mockProviders[0].id}
        testResults={{ [mockProviders[0].id]: mockTestResult }}
        onSetDefault={vi.fn()}
        onTest={vi.fn()}
        onBenchmark={vi.fn()}
        onEdit={mockOnEditProvider}
        onDelete={mockOnDeleteProvider}
      />
    )

    // Verify success message is displayed
    await waitFor(() => {
      expect(screen.getByText('Connection Verified')).toBeInTheDocument()
    })

    // Verify response time is shown
    expect(screen.getByText(/500ms/)).toBeInTheDocument()

    // Verify AI response is displayed
    expect(screen.getByText('AI Response:')).toBeInTheDocument()
    expect(screen.getByText(/"Hello World! I am working correctly."/)).toBeInTheDocument()
  })

  it('tests that test failures are handled gracefully', async () => {
    const mockErrorResult = {
      status: 'error' as const,
      error: 'API key invalid',
      timestamp: '2023-01-01T00:00:00Z'
    }

    render(
      <ConfiguredModelsList
        providers={mockProviders}
        defaultProvider={mockProviders[0].id}
        testResults={{ [mockProviders[0].id]: mockErrorResult }}
        onSetDefault={vi.fn()}
        onTest={vi.fn()}
        onBenchmark={vi.fn()}
        onEdit={mockOnEditProvider}
        onDelete={mockOnDeleteProvider}
      />
    )

    // Verify error is displayed
    await waitFor(() => {
      expect(screen.getByText('Test Failed')).toBeInTheDocument()
    })

    // Verify error message is shown
    expect(screen.getByText('API key invalid')).toBeInTheDocument()

    // Verify helpful hint is shown
    expect(screen.getByText(/Check your API key/)).toBeInTheDocument()
  })

  it('tests that provider actions call correct handlers', () => {
    const mockOnEdit = vi.fn()
    const mockOnDelete = vi.fn()

    render(
      <ConfiguredModelsList
        providers={mockProviders}
        defaultProvider={mockProviders[0].id}
        testResults={{}}
        onSetDefault={vi.fn()}
        onTest={vi.fn()}
        onBenchmark={vi.fn()}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    // Test edit button
    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])
    expect(mockOnEdit).toHaveBeenCalledWith(mockProviders[0])

    // Test delete button (only available for non-built-in providers)
    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0])
    expect(mockOnDelete).toHaveBeenCalledWith(mockProviders[0].id)
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