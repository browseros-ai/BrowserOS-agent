import React, { useState, useRef, useEffect } from 'react'
import { ProviderDropdown } from './ProviderDropdown'
import { CommandPalette } from './CommandPalette'
import { SearchDropdown } from './SearchDropdown'
import { useProviderStore } from '../stores/providerStore'
import { useAgentsStore } from '../stores/agentsStore'

interface CommandInputProps {
  onCreateAgent?: () => void
}

export function CommandInput({ onCreateAgent }: CommandInputProps = {}) {
  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [isExecutingAgent, setIsExecutingAgent] = useState(false)
  const [executingAgentName, setExecutingAgentName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { getSelectedProvider, executeProviderAction, executeAgent } = useProviderStore()
  const { agents, selectedAgentId } = useAgentsStore()
  
  const selectedProvider = getSelectedProvider()
  
  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  
  const handleProviderSelect = async (provider: any, query: string) => {
    setShowSearchDropdown(false)
    
    // Execute based on provider type
    if (provider.id === 'google') {
      window.open(`https://google.com/search?q=${encodeURIComponent(query)}`, '_blank')
    } else if (provider.id === 'chatgpt') {
      window.open(`https://chatgpt.com/?q=${encodeURIComponent(query)}`, '_blank')
    } else if (provider.id === 'claude') {
      window.open(`https://claude.ai/new?q=${encodeURIComponent(query)}`, '_blank')
    } else if (provider.id === 'browseros') {
      const browserosProvider = { 
        id: 'browseros-agent', 
        name: 'BrowserOS Agent', 
        category: 'llm' as const,
        actionType: 'sidepanel' as const,
        available: true
      }
      await executeProviderAction(browserosProvider, query)
    }
    
    setValue('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    
    // Don't submit if dropdowns are open
    if (showCommandPalette || showSearchDropdown) return
    
    const query = value.trim()
    
    console.log('CommandInput handleSubmit:', { selectedAgentId, agents, query })
    
    // Execute provider-specific action or agent
    if (selectedAgentId) {
      // Execute selected agent
      const agent = agents.find(a => a.id === selectedAgentId)
      console.log('Found agent:', agent)
      if (agent) {
        console.log('Executing agent:', agent.name, 'with query:', query)
        await executeAgent(agent, query)
      }
    } else if (selectedProvider) {
      console.log('Executing provider:', selectedProvider.name, 'with query:', query)
      await executeProviderAction(selectedProvider, query)
    }
    
    setValue('')
  }
  
  // Simple placeholder
  const getPlaceholder = () => {
    return 'Ask anything or type "/" to run agents'
  }
  
  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className={`
        relative flex items-center gap-3
        bg-background/80 backdrop-blur-sm border-2 rounded-xl
        transition-all duration-300 ease-out
        ${isFocused ? 'border-[hsl(var(--brand))]/60 shadow-lg' : 'border-[hsl(var(--brand))]/30 hover:border-[hsl(var(--brand))]/50 hover:bg-background/90'}
        px-4 py-3
      `}>
        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            const newValue = e.target.value
            setValue(newValue)
            
            // Show command palette when user types '/'
            if (newValue === '/' || (newValue.startsWith('/') && showCommandPalette)) {
              setShowCommandPalette(true)
              setShowSearchDropdown(false)
            } else {
              setShowCommandPalette(false)
              // Show search dropdown when there's text (not starting with '/')
              setShowSearchDropdown(newValue.trim().length > 0)
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => {
            setIsFocused(false)
            setShowSearchDropdown(false)
          }, 200)}
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
      
      {/* Search Dropdown */}
      {showSearchDropdown && !showCommandPalette && (
        <SearchDropdown
          query={value}
          onSelect={handleProviderSelect}
          onClose={() => setShowSearchDropdown(false)}
        />
      )}
      
      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette
          searchQuery={value}
          onSelectAgent={async (agentId) => {
            // Find and execute the agent immediately
            const agent = agents.find(a => a.id === agentId)
            if (agent) {
              // Update UI to show agent is executing
              setIsExecutingAgent(true)
              setExecutingAgentName(agent.name)
              setValue(`Executing agent: ${agent.name}`)
              setShowCommandPalette(false)
              
              // Execute the agent with its goal as the query
              console.log('Executing agent immediately:', agent.name)
              await executeAgent(agent, agent.goal)
              
              // Reset after a short delay
              setTimeout(() => {
                setIsExecutingAgent(false)
                setExecutingAgentName('')
                setValue('')
                inputRef.current?.focus()
              }, 2000)
            }
          }}
          onCreateAgent={() => {
            // Navigate to agent creation view
            if (onCreateAgent) {
              onCreateAgent()
            }
            setValue('')
            setShowCommandPalette(false)
          }}
          onClose={() => {
            setShowCommandPalette(false)
            setValue('')
            inputRef.current?.focus()
          }}
        />
      )}
    </form>
  )
}