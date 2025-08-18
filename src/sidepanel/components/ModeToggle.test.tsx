import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ModeToggle } from './ModeToggle'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'

// Mock the settings store
vi.mock('@/sidepanel/stores/settingsStore', () => ({
  useSettingsStore: vi.fn()
}))

describe('ModeToggle', () => {
  const mockSetChatMode = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('tests that the toggle displays Browse mode as active by default', () => {
    vi.mocked(useSettingsStore).mockReturnValue({
      chatMode: false,
      setChatMode: mockSetChatMode
    } as any)
    
    render(<ModeToggle />)
    
    const browseButton = screen.getByLabelText('Browse mode for automation')
    const chatButton = screen.getByLabelText('Chat mode for Q&A')
    
    expect(browseButton).toHaveClass('active')
    expect(chatButton).not.toHaveClass('active')
  })
  
  it('tests that clicking Chat button enables chat mode', () => {
    vi.mocked(useSettingsStore).mockReturnValue({
      chatMode: false,
      setChatMode: mockSetChatMode
    } as any)
    
    render(<ModeToggle />)
    
    const chatButton = screen.getByLabelText('Chat mode for Q&A')
    fireEvent.click(chatButton)
    
    expect(mockSetChatMode).toHaveBeenCalledWith(true)
  })
  
  it('tests that clicking Browse button disables chat mode', () => {
    vi.mocked(useSettingsStore).mockReturnValue({
      chatMode: true,
      setChatMode: mockSetChatMode
    } as any)
    
    render(<ModeToggle />)
    
    const browseButton = screen.getByLabelText('Browse mode for automation')
    fireEvent.click(browseButton)
    
    expect(mockSetChatMode).toHaveBeenCalledWith(false)
  })
})