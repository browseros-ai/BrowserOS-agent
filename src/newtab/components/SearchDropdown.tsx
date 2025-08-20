import React, { useState, useEffect } from 'react'

interface SearchProvider {
  id: string
  name: string
  icon: string
}

const DEFAULT_PROVIDERS: SearchProvider[] = [
  { id: 'google', name: 'Google', icon: '/assets/new_tab_search/google.svg' },
  { id: 'chatgpt', name: 'ChatGPT', icon: '/assets/new_tab_search/openai.svg' },
  { id: 'claude', name: 'Claude', icon: '/assets/new_tab_search/claude.svg' },
  { id: 'browseros', name: 'BrowserOS Agent', icon: '/assets/new_tab_search/browseros.svg' }
]

function getEnabledProviders(): SearchProvider[] {
  const stored = localStorage.getItem('searchProviders')
  if (!stored) return DEFAULT_PROVIDERS
  
  try {
    const data = JSON.parse(stored)
    return data.enabled || DEFAULT_PROVIDERS
  } catch {
    return DEFAULT_PROVIDERS
  }
}

interface SearchDropdownProps {
  query: string
  onSelect: (provider: SearchProvider, query: string) => void
  onClose: () => void
}

export function SearchDropdown ({ query, onSelect, onClose }: SearchDropdownProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const providers = getEnabledProviders()

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => (i + 1) % providers.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => (i - 1 + providers.length) % providers.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onSelect(providers[activeIndex], query)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, query, onSelect, onClose, providers])

  return (
    <div className='absolute top-full mt-2 left-0 right-0 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50'>
      {providers.map((provider, index) => (
        <button
          key={provider.id}
          className={`
            w-full flex items-center gap-3 px-4 py-2.5
            hover:bg-accent transition-colors
            ${index === activeIndex ? 'bg-accent' : ''}
          `}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => onSelect(provider, query)}
        >
          <img src={provider.icon} alt={provider.name} className='w-5 h-5 flex-shrink-0' />
          <span className='text-sm w-32 text-left flex-shrink-0'>{provider.name}</span>
          <span className='text-sm text-muted-foreground text-left truncate'>{query}</span>
        </button>
      ))}
    </div>
  )
}