import React, { useEffect, useRef, useState } from 'react'
import { useAgentsStore, agentSelectors } from '../stores/agentsStore'
import { ChevronRight, Plus, Bot } from 'lucide-react'

interface CommandPaletteProps {
  searchQuery: string
  onSelectAgent: (agentId: string) => void
  onCreateAgent: () => void
  onClose: () => void
}

export function CommandPalette({ searchQuery, onSelectAgent, onCreateAgent, onClose }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const paletteRef = useRef<HTMLDivElement>(null)
  const { agents, selectAgent } = useAgentsStore()
  
  // Filter agents based on search query (after the slash)
  const query = searchQuery.slice(1).toLowerCase()
  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(query) ||
    agent.description.toLowerCase().includes(query)
  )
  
  // Total items = filtered agents + create option
  const totalItems = filteredAgents.length + 1
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % totalItems)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems)
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
  
  const handleSelection = async () => {
    if (selectedIndex < filteredAgents.length) {
      const agent = filteredAgents[selectedIndex]
      
      // Update last used timestamp
      useAgentsStore.getState().updateAgent(agent.id, { 
        lastUsed: Date.now() 
      })
      
      // Execute the agent immediately with its goal as the query
      onSelectAgent(agent.id)
    } else {
      // Create new agent selected
      onCreateAgent()
    }
  }
  
  return (
    <div 
      ref={paletteRef}
      className="
        absolute top-full left-0 right-0 mt-2
        bg-card border border-border rounded-xl shadow-2xl
        overflow-hidden z-50
        max-h-[400px] overflow-y-auto
      "
    >
      <div className="p-2">
        {/* Header */}
        <div className="text-xs text-muted-foreground px-3 py-2 font-medium">
          AGENTS
        </div>
        
        {/* Agent List */}
        {filteredAgents.map((agent, index) => (
          <button
            key={agent.id}
            onClick={() => {
              setSelectedIndex(index)
              handleSelection()
            }}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
              text-left transition-colors duration-150
              ${selectedIndex === index 
                ? 'bg-accent text-accent-foreground' 
                : 'hover:bg-accent/50'
              }
            `}
          >
            <Bot className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                / {agent.name}
              </div>
              {agent.description && (
                <div className="text-xs text-muted-foreground truncate">
                  {agent.description}
                </div>
              )}
            </div>
            {agent.isPinned && (
              <div className="text-xs text-muted-foreground">
                Pinned
              </div>
            )}
          </button>
        ))}
        
        {/* Divider */}
        {filteredAgents.length > 0 && (
          <div className="my-2 border-t border-border" />
        )}
        
        {/* Create Agent Option */}
        <button
          onClick={() => {
            setSelectedIndex(filteredAgents.length)
            handleSelection()
          }}
          onMouseEnter={() => setSelectedIndex(filteredAgents.length)}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
            text-left transition-colors duration-150
            ${selectedIndex === filteredAgents.length 
              ? 'bg-accent text-accent-foreground' 
              : 'hover:bg-accent/50'
            }
          `}
        >
          <Plus className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="font-medium text-sm">
              Create/Edit agent
            </div>
            <div className="text-xs text-muted-foreground">
              Define a new agent with custom goals and tools
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      
      {/* Footer hint */}
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