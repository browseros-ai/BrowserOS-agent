import React, { useState, useEffect } from 'react'
import { GripVertical, X, Plus } from 'lucide-react'

interface Provider {
  id: string
  name: string
  icon: string
}

const ALL_PROVIDERS: Provider[] = [
  { id: 'google', name: 'Google', icon: '/assets/new_tab_search/google.svg' },
  { id: 'chatgpt', name: 'ChatGPT', icon: '/assets/new_tab_search/openai.svg' },
  { id: 'claude', name: 'Claude', icon: '/assets/new_tab_search/claude.svg' },
  { id: 'browseros', name: 'BrowserOS Agent', icon: '/assets/new_tab_search/browseros.svg' }
]

export function ProviderSettings() {
  const [enabled, setEnabled] = useState<Provider[]>(ALL_PROVIDERS)
  const [disabled, setDisabled] = useState<Provider[]>([])
  const [draggedItem, setDraggedItem] = useState<Provider | null>(null)
  const [draggedFrom, setDraggedFrom] = useState<'enabled' | 'disabled' | null>(null)
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('searchProviders')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.enabled && data.enabled.length > 0) {
          setEnabled(data.enabled)
          setDisabled(data.disabled || [])
        } else {
          // If no enabled providers, use defaults
          setEnabled(ALL_PROVIDERS)
          setDisabled([])
        }
      } catch {
        setEnabled(ALL_PROVIDERS)
        setDisabled([])
      }
    } else {
      // First time - set all providers as enabled
      setEnabled(ALL_PROVIDERS)
      setDisabled([])
    }
  }, [])

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem('searchProviders', JSON.stringify({
      enabled,
      disabled
    }))
  }, [enabled, disabled])

  const handleDragStart = (provider: Provider, from: 'enabled' | 'disabled') => {
    setDraggedItem(provider)
    setDraggedFrom(from)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDraggedFrom(null)
    setDraggedOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDropOnProvider = (e: React.DragEvent, targetIndex: number, targetList: 'enabled' | 'disabled') => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedItem || !draggedFrom) return

    if (draggedFrom === targetList) {
      // Reordering within same list
      const list = targetList === 'enabled' ? enabled : disabled
      const newList = [...list]
      const currentIndex = newList.findIndex(p => p.id === draggedItem.id)
      
      // Remove from current position
      newList.splice(currentIndex, 1)
      // Insert at new position
      newList.splice(targetIndex, 0, draggedItem)
      
      if (targetList === 'enabled') {
        setEnabled(newList)
      } else {
        setDisabled(newList)
      }
    } else {
      // Moving between lists
      if (draggedFrom === 'enabled') {
        const newEnabled = enabled.filter(p => p.id !== draggedItem.id)
        const newDisabled = [...disabled]
        newDisabled.splice(targetIndex, 0, draggedItem)
        setEnabled(newEnabled)
        setDisabled(newDisabled)
      } else {
        const newDisabled = disabled.filter(p => p.id !== draggedItem.id)
        const newEnabled = [...enabled]
        newEnabled.splice(targetIndex, 0, draggedItem)
        setDisabled(newDisabled)
        setEnabled(newEnabled)
      }
    }

    setDraggedItem(null)
    setDraggedFrom(null)
    setDraggedOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, to: 'enabled' | 'disabled') => {
    e.preventDefault()
    if (!draggedItem || !draggedFrom) return

    if (draggedFrom === to) {
      // If dropping in same list without specific position, do nothing
      return
    }

    // Moving between lists (append to end)
    if (draggedFrom === 'enabled') {
      setEnabled(prev => prev.filter(p => p.id !== draggedItem.id))
      setDisabled(prev => [...prev, draggedItem])
    } else {
      setDisabled(prev => prev.filter(p => p.id !== draggedItem.id))
      setEnabled(prev => [...prev, draggedItem])
    }

    setDraggedItem(null)
    setDraggedFrom(null)
    setDraggedOverIndex(null)
  }

  const disableProvider = (providerId: string) => {
    const provider = enabled.find(p => p.id === providerId)
    if (provider) {
      setEnabled(prev => prev.filter(p => p.id !== providerId))
      setDisabled(prev => [...prev, provider])
    }
  }

  const enableProvider = (providerId: string) => {
    const provider = disabled.find(p => p.id === providerId)
    if (provider) {
      setDisabled(prev => prev.filter(p => p.id !== providerId))
      setEnabled(prev => [...prev, provider])
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Manage Search Providers</h3>
      <p className="text-xs text-muted-foreground">Drag providers to reorder or move between enabled/disabled</p>

      {/* Enabled Providers */}
      <div>
        <label className="text-sm font-medium mb-2 block">Visible in search dropdown</label>
        <div
          className="border rounded-lg p-2 min-h-[100px] bg-card"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'enabled')}
        >
          {enabled.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Drag providers here to enable
            </p>
          ) : (
            enabled.map((provider, index) => (
              <div
                key={provider.id}
                draggable
                onDragStart={() => handleDragStart(provider, 'enabled')}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDraggedOverIndex(index)
                }}
                onDrop={(e) => handleDropOnProvider(e, index, 'enabled')}
                onDragLeave={() => setDraggedOverIndex(null)}
                className={`flex items-center gap-2 p-2 rounded hover:bg-accent cursor-move transition-all ${
                  draggedOverIndex === index && draggedFrom === 'enabled' ? 'border-t-2 border-primary' : ''
                }`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <img src={provider.icon} alt={provider.name} className="w-5 h-5" />
                <span className="flex-1 text-sm">{provider.name}</span>
                <button
                  onClick={() => disableProvider(provider.id)}
                  className="p-1 hover:bg-background rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Disabled Providers */}
      <div>
        <label className="text-sm font-medium mb-2 block">Disabled providers</label>
        <div
          className="border rounded-lg p-2 min-h-[60px] bg-muted/20"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'disabled')}
        >
          {disabled.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Drag here to disable a provider
            </p>
          ) : (
            disabled.map((provider, index) => (
              <div
                key={provider.id}
                draggable
                onDragStart={() => handleDragStart(provider, 'disabled')}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDraggedOverIndex(index)
                }}
                onDrop={(e) => handleDropOnProvider(e, index, 'disabled')}
                onDragLeave={() => setDraggedOverIndex(null)}
                className={`flex items-center gap-2 p-2 rounded hover:bg-accent cursor-move opacity-60 transition-all ${
                  draggedOverIndex === index && draggedFrom === 'disabled' ? 'border-t-2 border-primary' : ''
                }`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <img src={provider.icon} alt={provider.name} className="w-5 h-5" />
                <span className="flex-1 text-sm">{provider.name}</span>
                <button
                  onClick={() => enableProvider(provider.id)}
                  className="p-1 hover:bg-background rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}