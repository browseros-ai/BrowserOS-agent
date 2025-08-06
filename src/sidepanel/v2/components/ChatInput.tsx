import React, { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/sidepanel/components/ui/textarea'
import { Button } from '@/sidepanel/components/ui/button'
import { LazyTabSelector } from './LazyTabSelector'
import { useChatStore } from '../stores/chatStore'
import { useKeyboardShortcuts, useAutoResize } from '../hooks/useKeyboardShortcuts'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { cn } from '@/sidepanel/lib/utils'
import { TabsIcon, CloseIcon, SendIcon, LoadingPawTrail } from './ui/Icons';

interface ChatInputProps {
  isConnected: boolean
  isProcessing: boolean
  onToggleSelectTabs: () => void
  showSelectTabsButton: boolean
}

/**
 * Chat input component with auto-resize, tab selection, and keyboard shortcuts
 */
export function ChatInput({ isConnected, isProcessing, onToggleSelectTabs, showSelectTabsButton }: ChatInputProps) {
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
    if (!isConnected) return 'Disconnected'
    if (isProcessing) return 'Interrupt with new task'
    return 'Ask me anything'
  }
  
  const getHintText = () => {
    if (!isConnected) return 'Waiting for connection'
    if (isProcessing) return 'Press Enter to interrupt • Esc to cancel'
    return 'Press Enter to send • @ to select tabs'
  }

  const getLoadingIndicator = () => {
    if (!isConnected || isProcessing) {
      return <LoadingPawTrail />
    }
    return null
  }
  
  return (
    <div className="relative bg-gradient-to-t from-background via-background to-background/95 p-6 flex-shrink-0 overflow-hidden">
      
      {/* Spotlight effect from bottom of page */}
      <div className="absolute top-20 left-0 w-full h-40">
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-80 h-40 bg-gradient-radial from-brand/30 via-brand/15 to-transparent animate-spotlight-pulse"></div>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-64 h-32 bg-gradient-radial from-brand/25 via-brand/10 to-transparent animate-spotlight-pulse-delayed" style={{ animationDelay: '1.9s' }}></div>
      </div>
      
      {/* Tab selector */}
      {showTabSelector && (
        <div className="absolute bottom-full left-6 right-6 mb-3 z-10 animate-in slide-in-from-bottom-2 duration-300">
          <LazyTabSelector 
            isOpen={showTabSelector}
            onClose={handleTabSelectorClose}
          />
        </div>
      )}
      
      {/* Input container */}
      <div className="relative">
        {/* Toggle Select Tabs Button */}
        <div className="flex justify-center mb-2">
          <Button
            type="button"
            onClick={onToggleSelectTabs}
            size="sm"
            variant="ghost"
            className="h-8 px-3 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 text-xs"
            aria-label={showSelectTabsButton ? 'Hide tab selector' : 'Show tab selector'}
          >
            <TabsIcon />
            {showSelectTabsButton ? 'Hide Tabs' : 'Show Tabs'}
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="w-full" role="form" aria-label="Chat input form">
          <div className="relative flex items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              placeholder={getPlaceholder()}
              disabled={!isConnected}
              className={cn(
                'max-h-[200px] resize-none pr-20 text-sm',
                'transition-all duration-300',
                'bg-background/80 backdrop-blur-sm border-2 border-brand/30',
                'focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:border-brand',
                'hover:border-brand/50 hover:bg-background/90',
                'rounded-2xl shadow-lg',
                !isConnected && 'opacity-50 cursor-not-allowed bg-muted'
              )}
              rows={1}
              aria-label="Chat message input"
              aria-describedby="input-hint"
              aria-invalid={!isConnected}
              aria-disabled={!isConnected}
            />
            
            <Button
              type="submit"
              disabled={!isConnected || (!input.trim() && !isProcessing)}
              size="sm"
              className="absolute right-2 bottom-2 h-10 px-4 rounded-xl bg-gradient-to-r from-brand to-brand/80 hover:from-brand/90 hover:to-brand/70 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-brand focus:ring-offset-2"
              variant={isProcessing && !input.trim() ? 'destructive' : 'default'}
              aria-label={isProcessing && !input.trim() ? 'Cancel current task' : 'Send message'}
            >
              {isProcessing && !input.trim() ? (
                <CloseIcon />
              ) : (
                <SendIcon />
              )}
            </Button>
          </div>
        </form>
        
        <div 
          id="input-hint" 
          className="mt-3 text-center text-xs text-muted-foreground font-medium flex items-center justify-center gap-2"
          role="status"
          aria-live="polite"
        >
          {getLoadingIndicator()}
          <span>{getHintText()}</span>
        </div>
      </div>
    </div>
  )
}