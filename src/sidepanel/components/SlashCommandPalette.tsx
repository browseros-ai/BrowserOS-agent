import React, { useEffect, useRef, useState } from 'react'
import { useAgentsStore } from '@/newtab/stores/agentsStore'
import { ChevronRight, Plus, Bot } from 'lucide-react'

interface SlashCommandPaletteProps {
  searchQuery: string
  onSelectAgent: (agentId: string) => void
  onCreateAgent?: () => void
  onClose: () => void
  overlay?: boolean
}

/**
 * Lightweight slash-commands palette for the sidepanel.
 * Mirrors New Tab's CommandPalette filtering agents on `/` input.
 */
export function SlashCommandPalette({ searchQuery, onSelectAgent, onCreateAgent, onClose, overlay = false }: SlashCommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const paletteRef = useRef<HTMLDivElement>(null)
  const { agents } = useAgentsStore()

  // Filter agents based on search query (after the slash)
  const query = (searchQuery || '').slice(1).toLowerCase()
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(query) ||
    (agent.description || '').toLowerCase().includes(query)
  )
  

  // Total items = filtered agents + optional create option
  const includeCreate = Boolean(onCreateAgent)
  const totalItems = filteredAgents.length + (includeCreate ? 1 : 0)

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (totalItems > 0) setSelectedIndex(prev => (prev + 1) % totalItems)
          break
        case 'ArrowUp':
          e.preventDefault()
          if (totalItems > 0) setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems)
          break
        case 'Enter':
          e.preventDefault()
          handleSelection()
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, totalItems, filteredAgents])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleSelection = () => {
    if (selectedIndex < filteredAgents.length) {
      const agent = filteredAgents[selectedIndex]
      onSelectAgent(agent.id)
    } else if (includeCreate && onCreateAgent) {
      onCreateAgent()
    }
  }

  const containerClass = overlay
    ? 'bg-background border border-border rounded-xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto'
    : 'absolute bottom-full left-0 right-0 mb-2 bg-background border border-border rounded-xl shadow-2xl overflow-hidden z-50 max-h-[300px] overflow-y-auto'

  return (
    <div
      ref={paletteRef}
      className={containerClass}
      role="listbox"
      aria-label="Slash command palette"
      style={{ maxHeight: 'min(300px, 50vh)' }}
    >
      <div className="p-2">
        <div className="text-xs text-muted-foreground px-3 py-2 font-medium">AGENTS ({filteredAgents.length})</div>
        {filteredAgents.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            {agents.length === 0 ? 'Loading agents...' : 'No agents match your search'}
          </div>
        ) : (
        filteredAgents.map((agent, index) => (
          <button
            key={agent.id}
            onClick={() => { setSelectedIndex(index); handleSelection() }}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-150 ${selectedIndex === index ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
            role="option"
            aria-selected={selectedIndex === index}
          >
            <Bot className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">/ {agent.name}</div>
              {agent.description && (
                <div className="text-xs text-muted-foreground truncate">{agent.description}</div>
              )}
            </div>
            {agent.isPinned && (
              <div className="text-xs text-muted-foreground">Pinned</div>
            )}
          </button>
        )))}

        {includeCreate && (
          <button
            onClick={() => { setSelectedIndex(filteredAgents.length); handleSelection() }}
            onMouseEnter={() => setSelectedIndex(filteredAgents.length)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-150 ${selectedIndex === filteredAgents.length ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium text-sm">Create/Edit agent</div>
              <div className="text-xs text-muted-foreground">Define a new agent with custom goals and tools</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border bg-muted/30">
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  )
}
