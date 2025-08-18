import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSettingsStore } from './settingsStore'

// Mock document for testing
const mockDocument = {
  documentElement: {
    style: {
      setProperty: vi.fn(),
      removeProperty: vi.fn()
    },
    classList: {
      add: vi.fn(),
      remove: vi.fn()
    }
  }
}

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => null), // Return null to use defaults
  setItem: vi.fn(),
  removeItem: vi.fn()
}

// Setup mocks
beforeEach(() => {
  vi.clearAllMocks()
  
  // Mock global objects
  global.document = mockDocument as any
  global.localStorage = mockLocalStorage as any
  
  // Reset store to initial state
  useSettingsStore.setState({
    fontSize: 14,
    theme: 'light'
  })
})

describe('SettingsStore', () => {
  it('should be created with default values', () => {
    const store = useSettingsStore.getState()
    
    expect(store.fontSize).toBe(14)
    expect(store.theme).toBe('light')
  })

  it('should have setFontSize and setDarkMode methods', () => {
    const store = useSettingsStore.getState()
    
    expect(typeof store.setFontSize).toBe('function')
    expect(typeof store.setTheme).toBe('function')
    expect(typeof store.resetSettings).toBe('function')
  })

  it('should call document methods when setFontSize is called', () => {
    const store = useSettingsStore.getState()
    
    store.setFontSize(18)
    
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith('--app-font-size', '18px')
  })

  it('should call document methods when setTheme is called', () => {
    const store = useSettingsStore.getState()
    
    store.setTheme('dark')
    
    expect(mockDocument.documentElement.classList.add).toHaveBeenCalledWith('dark')
  })

  it('should call document methods when resetSettings is called', () => {
    const store = useSettingsStore.getState()
    
    store.resetSettings()
    
    expect(mockDocument.documentElement.style.removeProperty).toHaveBeenCalledWith('--app-font-size')
    expect(mockDocument.documentElement.classList.remove).toHaveBeenCalledWith('dark')
    expect(mockDocument.documentElement.classList.remove).toHaveBeenCalledWith('gray')
  })
}) 