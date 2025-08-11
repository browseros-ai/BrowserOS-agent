import React, { useState, useRef, useEffect } from 'react'
import { SendIcon, SettingsIcon } from '@/sidepanel/v2/components/ui/Icons'
import { useAgentsStore } from '../stores/agentsStore'
import { useChatStore } from '@/sidepanel/v2/stores/chatStore'

export function CommandInput() {
  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { selectedAgentId, setCreating } = useAgentsStore()
  const { addMessage, setProcessing } = useChatStore()
  
  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    
    // Process the command
    if (value.startsWith('@')) {
      // Handle @mention for tabs/agents
      handleMention(value)
    } else if (value.startsWith('/')) {
      // Handle slash commands
      handleCommand(value)
    } else {
      // Regular query - send to chat
      addMessage({ role: 'user', content: value })
      setProcessing(true)
      // Port message will be handled by existing infrastructure
    }
    
    setValue('')
  }
  
  const handleMention = (mention: string) => {
    // Parse and handle @mentions
    console.log('Handling mention:', mention)
  }
  
  const handleCommand = (command: string) => {
    // Parse and handle slash commands
    console.log('Handling command:', command)
  }
  
  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className={`
        relative flex items-center
        bg-card border rounded-2xl
        transition-all duration-200
        ${isFocused ? 'border-primary shadow-lg scale-105' : 'border-border shadow-md'}
        hover:shadow-lg
      `}>
        {/* Search Icon */}
        <div className="pl-6 pr-2 text-muted-foreground">
          <SendIcon />
        </div>
        
        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="Ask anything or @mention a tab..."
          className="
            flex-1 py-4 pr-2
            bg-transparent border-none outline-none
            text-lg placeholder:text-muted-foreground
          "
          aria-label="Command input"
          autoComplete="off"
          spellCheck={false}
        />
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2 pr-4">
          {/* New Agent */}
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            aria-label="Create new agent"
            onClick={() => setCreating(true)}
          >
            <SettingsIcon />
          </button>
        </div>
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