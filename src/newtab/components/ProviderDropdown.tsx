import React, { useRef, useEffect } from 'react'
import { useProviderStore } from '../stores/providerStore'
import { ChevronDown, Check } from 'lucide-react'

export function ProviderDropdown() {
  const { 
    getEnabledProviders, 
    selectedProviderId, 
    isDropdownOpen, 
    selectProvider, 
    toggleDropdown,
    closeDropdown,
    getSelectedProvider
  } = useProviderStore()
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selectedProvider = getSelectedProvider()
  const providers = getEnabledProviders()
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown()
      }
    }
    
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen, closeDropdown])
  
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className="
          flex items-center gap-1.5 px-3 py-1.5 h-8
          text-sm font-medium
          bg-background border border-border rounded-lg
          hover:bg-accent transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
        "
        onClick={toggleDropdown}
        aria-label="Select provider"
        aria-expanded={isDropdownOpen}
        aria-haspopup="listbox"
      >
        <span className="text-foreground">{selectedProvider?.name || 'ChatGPT'}</span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="
          absolute top-full left-0 mt-1 w-48
          bg-card border border-border rounded-lg shadow-lg
          py-1 z-50
        "
        role="listbox"
        aria-label="Provider options"
        >
          {providers.map(provider => (
            <button
              key={provider.id}
              className={`
                w-full text-left px-3 py-2
                hover:bg-accent transition-colors
                focus:outline-none focus:bg-accent
                flex items-center justify-between
                ${selectedProviderId === provider.id ? 'bg-accent/50' : ''}
              `}
              onClick={() => selectProvider(provider.id)}
              role="option"
              aria-selected={selectedProviderId === provider.id}
            >
              <span className="text-sm text-foreground">{provider.name}</span>
              {selectedProviderId === provider.id && (
                <Check className="w-3 h-3 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
