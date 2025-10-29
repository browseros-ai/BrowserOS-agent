import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddProviderModal } from './AddProviderModal'
import { LLMProvider } from '../types/llm-settings'

describe('AddProviderModal-unit-test', () => {
  const mockOnClose = vi.fn()
  const mockOnSave = vi.fn()

  const editProvider: LLMProvider = {
    id: 'test-edit-1',
    name: 'Test Provider',
    type: 'openai',
    modelId: 'gpt-4',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    isBuiltIn: false,
    isDefault: false,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tests that modal can be created and configured for new provider', () => {
    render(
      <AddProviderModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    expect(screen.getByText('Configure New Provider')).toBeInTheDocument()
    expect(screen.getByLabelText(/Provider Type/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Provider Name/)).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('tests that modal form updates state when fields change', async () => {
    render(
      <AddProviderModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    // Change provider name
    const nameInput = screen.getByLabelText(/Provider Name/)
    fireEvent.change(nameInput, { target: { value: 'My Custom Provider' } })
    expect(nameInput).toHaveValue('My Custom Provider')

    // Change provider type
    const typeSelect = screen.getByLabelText(/Provider Type/)
    fireEvent.change(typeSelect, { target: { value: 'anthropic' } })
    expect(typeSelect).toHaveValue('anthropic')

    // Change API key
    const apiKeyInput = screen.getByLabelText(/API Key/)
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } })
    expect(apiKeyInput).toHaveValue('test-api-key')
  })

  it('tests that save validation prevents empty names', async () => {
    // Mock alert to capture validation message
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(
      <AddProviderModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    // Try to save with empty name
    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    // Verify validation
    expect(alertSpy).toHaveBeenCalledWith('Please enter a provider name')
    expect(mockOnSave).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })

  it('tests that save calls onSave with correct provider data', async () => {
    mockOnSave.mockResolvedValue(undefined)

    render(
      <AddProviderModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    // Fill form
    const nameInput = screen.getByLabelText(/Provider Name/)
    fireEvent.change(nameInput, { target: { value: 'Test Provider' } })

    const typeSelect = screen.getByLabelText(/Provider Type/)
    fireEvent.change(typeSelect, { target: { value: 'openai' } })

    const apiKeyInput = screen.getByLabelText(/API Key/)
    fireEvent.change(apiKeyInput, { target: { value: 'test-key' } })

    // Save
    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    // Verify onSave called with correct data
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Provider',
          type: 'openai',
          apiKey: 'test-key',
          isBuiltIn: false,
          isDefault: false
        })
      )
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('tests that edit mode populates form with existing provider data', () => {
    render(
      <AddProviderModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        editProvider={editProvider}
      />
    )

    expect(screen.getByText('Edit Provider')).toBeInTheDocument()
    expect(screen.getByLabelText(/Provider Name/)).toHaveValue('Test Provider')
    expect(screen.getByLabelText(/Provider Type/)).toHaveValue('openai')
    expect(screen.getByLabelText(/API Key/)).toHaveValue('test-key')

    // Provider type should be disabled in edit mode
    expect(screen.getByLabelText(/Provider Type/)).toBeDisabled()
  })
})

describe('AddProviderModal-integration-test', () => {
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'tests that modal works with real form submission',
    async () => {
      const mockOnClose = vi.fn()
      const mockOnSave = vi.fn().mockResolvedValue(undefined)

      render(
        <AddProviderModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Fill out a realistic provider configuration
      const nameInput = screen.getByLabelText(/Provider Name/)
      fireEvent.change(nameInput, { target: { value: 'Integration Test Provider' } })

      const typeSelect = screen.getByLabelText(/Provider Type/)
      fireEvent.change(typeSelect, { target: { value: 'openai' } })

      const apiKeyInput = screen.getByLabelText(/API Key/)
      fireEvent.change(apiKeyInput, { target: { value: process.env.LITELLM_API_KEY } })

      // Submit the form
      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      // Verify form submission works
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Integration Test Provider',
            type: 'openai'
          })
        )
      })

      console.log('✅ AddProviderModal integration test passed')
    },
    30000
  )
})