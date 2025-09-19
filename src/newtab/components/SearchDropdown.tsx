import React, { useEffect, useState, useMemo } from 'react'
import { useProviderStore, type Provider } from '../stores/providerStore'

interface SearchDropdownProps {
  query: string
  onSelect: (provider: Provider, query: string) => void
  onClose: () => void
}

function ensureProtocol(url: string) {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    return url
  }
  return `https://${url}`
}

function getFaviconFromPattern(urlPattern?: string) {
  if (!urlPattern) return undefined
  try {
    const sample = urlPattern.includes('%s') ? urlPattern.replace('%s', 'search') : urlPattern
    const normalized = ensureProtocol(sample)
    const parsed = new URL(normalized)
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`
  } catch {
    return undefined
  }
}

function getProviderIcon(provider: Provider) {
  return provider.iconUrl || getFaviconFromPattern(provider.urlPattern) || '/assets/new_tab_search/browseros.svg'
}

export function SearchDropdown({ query, onSelect, onClose }: SearchDropdownProps) {
  const enabledProviderIds = useProviderStore(state => state.enabledProviderIds)
  const defaultProviders = useProviderStore(state => state.providers)
  const customProviders = useProviderStore(state => state.customProviders)
  
  const providers = useMemo(() => {
    const allProviders = [...defaultProviders, ...customProviders]
    const providerMap = new Map(allProviders.map(provider => [provider.id, provider]))
    return enabledProviderIds
      .map(id => providerMap.get(id))
      .filter((provider): provider is Provider => Boolean(provider))
  }, [enabledProviderIds, defaultProviders, customProviders])
  
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (providers.length === 0) {
      setActiveIndex(0)
      return
    }
    setActiveIndex(index => Math.min(index, providers.length - 1))
  }, [providers])

  // Handle keyboard navigation
  useEffect(() => {
    if (providers.length === 0) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex(index => (index + 1) % providers.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex(index => (index - 1 + providers.length) % providers.length)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        onSelect(providers[activeIndex], query)
      } else if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, providers, query, onClose, onSelect])

  if (providers.length === 0) {
    return null
  }

  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      {providers.map((provider, index) => {
        const iconUrl = getProviderIcon(provider)
        return (
          <button
            key={provider.id}
            className={`
              flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors
              ${index === activeIndex ? 'bg-accent' : 'hover:bg-accent'}
            `}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => onSelect(provider, query)}
          >
            <img src={iconUrl} alt={provider.name} className="h-5 w-5 flex-shrink-0 rounded" />
            <span className="flex-shrink-0 w-32 text-sm text-foreground">{provider.name}</span>
            <span className="truncate text-sm text-muted-foreground">{query}</span>
          </button>
        )
      })}
    </div>
  )
}
