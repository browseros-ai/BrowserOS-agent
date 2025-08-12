import React, { useState, useRef, useEffect } from 'react'
import { ProviderDropdown } from './ProviderDropdown'
import { useProviderStore } from '../stores/providerStore'
import { executeProviderAction } from '../utils/providerActions'

export function CommandInput() {
  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { getSelectedProvider } = useProviderStore()
  
  const selectedProvider = getSelectedProvider()
  
  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    
    const query = value.trim()
    
    // Execute provider-specific action
    if (selectedProvider) {
      await executeProviderAction(selectedProvider, query)
    }
    
    setValue('')
  }
  
  // Dynamic placeholder based on selected provider
  const getPlaceholder = () => {
    if (!selectedProvider) return "Ask anything..."
    
    // Special case for BrowserOS Agent
    if (selectedProvider.id === 'browseros-agent') {
      return "Ask BrowserOS Agent to automate anything..."
    }
    
    switch(selectedProvider.category) {
      case 'search':
        return `Search with ${selectedProvider.name}...`
      case 'llm':
        return `Ask ${selectedProvider.name} anything...`
      default:
        return "Ask anything..."
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className={`
        relative flex items-center gap-3
        bg-card border rounded-xl
        transition-all duration-200
        ${isFocused ? 'border-primary shadow-lg' : 'border-border'}
        px-4 py-3
      `}>
        {/* Provider Dropdown */}
        <ProviderDropdown />
        
        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={getPlaceholder()}
          className="
            flex-1
            bg-transparent border-none outline-none
            text-base placeholder:text-muted-foreground
          "
          aria-label="Command input"
          autoComplete="off"
          spellCheck={false}
        />
        
      </div>
      
      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div className="
          absolute top-full left-0 right-0 mt-2
          bg-card border border-border rounded-lg shadow-lg
          py-2 z-10
        ">
          {/* Suggestions content */}
        </div>
      )}
    </form>
  )
}