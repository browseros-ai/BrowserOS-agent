import React, { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/sidepanel/components/ui/textarea'
import { Button } from '@/sidepanel/components/ui/button'
import { TabSelector } from './shared/TabSelector'
import { useChatStore } from '../stores/chatStore'
import { useKeyboardShortcuts, useAutoResize } from '../hooks/useKeyboardShortcuts'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { cn } from '@/sidepanel/lib/utils'

interface ChatInputProps {
  isConnected: boolean
  isProcessing: boolean
}

/**
 * Chat input component with auto-resize, tab selection, and keyboard shortcuts
 */
export function ChatInput({ isConnected, isProcessing }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [showTabSelector, setShowTabSelector] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { addMessage, setProcessing, selectedTabIds, clearSelectedTabs } = useChatStore()
  const { sendMessage } = useSidePanelPortMessaging()
  
  // Auto-resize textarea
  useAutoResize(textareaRef, input)
  
  // Focus textarea on mount and when processing stops
  useEffect(() => {
    const timer = setTimeout(() => {
      if (textareaRef.current && !isProcessing) {
        textareaRef.current.focus()
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [isProcessing])
  
  // Listen for example prompt clicks
  useEffect(() => {
    const handleSetInput = (e: CustomEvent) => {
      setInput(e.detail)
      textareaRef.current?.focus()
    }
    
    window.addEventListener('setInputValue', handleSetInput as EventListener)
    return () => {
      window.removeEventListener('setInputValue', handleSetInput as EventListener)
    }
  }, [])
  
  const submitTask = (query: string) => {
    if (!query.trim()) return
    
    if (!isConnected) {
      // Show error message in chat
      addMessage({
        role: 'system',
        content: 'Cannot send message: Extension is disconnected',
        metadata: { error: true }
      })
      return
    }
    
    // Add user message
    addMessage({
      role: 'user',
      content: query
    })
    
    // Get selected tab IDs from store
    const tabIds = selectedTabIds.length > 0 ? selectedTabIds : undefined
    
    // Send to background
    setProcessing(true)
    sendMessage(MessageType.EXECUTE_QUERY, {
      query: query.trim(),
      tabIds,
      source: 'sidepanel'
    })
    
    // Clear input and selected tabs
    setInput('')
    clearSelectedTabs()
    setShowTabSelector(false)
  }
  
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (isProcessing && input.trim()) {
      // Interrupt and follow-up pattern
      const followUpQuery = input.trim()
      
      // Cancel current task
      sendMessage(MessageType.CANCEL_TASK, {
        reason: 'User interrupted with new query',
        source: 'sidepanel'
      })
      
      // Keep processing state and submit follow-up after delay
      setTimeout(() => {
        submitTask(followUpQuery)
      }, 300)
    } else {
      // Normal submission
      submitTask(input)
    }
  }
  
  const handleCancel = () => {
    sendMessage(MessageType.CANCEL_TASK, {
      reason: 'User requested cancellation',
      source: 'sidepanel'
    })
    setProcessing(false)
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setInput(newValue)
    
    // Check for @ trigger
    const lastChar = newValue.slice(-1)
    if (lastChar === '@' && !showTabSelector) {
      // Only trigger if @ is at start or preceded by space
      const beforeAt = newValue.slice(0, -1)
      if (beforeAt === '' || beforeAt.endsWith(' ')) {
        setShowTabSelector(true)
      }
    }
    
    // Hide tab selector if input is cleared or @ is removed
    if (newValue === '' || (!newValue.includes('@') && showTabSelector)) {
      setShowTabSelector(false)
    }
  }
  
  const handleTabSelectorClose = () => {
    setShowTabSelector(false)
    textareaRef.current?.focus()
  }
  
  // Keyboard shortcuts
  useKeyboardShortcuts(
    {
      onSubmit: handleSubmit,
      onCancel: isProcessing ? handleCancel : undefined,
      onTabSelectorClose: handleTabSelectorClose
    },
    {
      isProcessing,
      showTabSelector
    }
  )
  
  const getPlaceholder = () => {
    if (!isConnected) return 'Disconnected...'
    if (isProcessing) return 'Interrupt with new task...'
    return 'Ask me anything...'
  }
  
  const getHintText = () => {
    if (!isConnected) return 'Waiting for connection...'
    if (isProcessing) return 'Press Enter to interrupt • Esc to cancel'
    return 'Press Enter to send • @ to select tabs'
  }
  
  return (
    <div className="relative border-t border-border bg-background p-4">
      {/* Tab selector - positioned absolutely above input */}
      {showTabSelector && (
        <div className="absolute bottom-full left-4 right-4 mb-2 z-10 animate-in slide-in-from-bottom-2 duration-200">
          <TabSelector 
            isOpen={showTabSelector}
            onClose={handleTabSelectorClose}
            filterQuery=""
          />
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative flex items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            placeholder={getPlaceholder()}
            disabled={!isConnected}
            className={cn(
              'min-h-[40px] max-h-[200px] resize-none pr-16 text-sm',
              'transition-all duration-200',
              !isConnected && 'opacity-50 cursor-not-allowed bg-muted'
            )}
            rows={1}
          />
          
          <Button
            type="submit"
            disabled={!isConnected || (!input.trim() && !isProcessing)}
            size="sm"
            className="absolute right-2 bottom-2 h-8 px-3"
            variant={isProcessing && !input.trim() ? 'destructive' : 'default'}
          >
            {isProcessing && !input.trim() ? 'Cancel' : 'Send'}
          </Button>
        </div>
      </form>
      
      <div className="mt-2 text-center text-xs text-muted-foreground">
        {getHintText()}
      </div>
    </div>
  )
}