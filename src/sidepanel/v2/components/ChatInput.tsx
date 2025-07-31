import React, { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/sidepanel/components/ui/textarea'
import { Button } from '@/sidepanel/components/ui/button'
import { TabSelector } from './shared/TabSelector'
import { useChatStore } from '../stores/chatStore'
import { useKeyboardShortcuts, useAutoResize } from '../hooks/useKeyboardShortcuts'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { cn } from '@/sidepanel/lib/utils'
import styles from '../styles/components/ChatInput.module.scss'

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
    <div className={cn(styles.chatInput, 'relative')}>
      {/* Tab selector - positioned absolutely above input */}
      {showTabSelector && (
        <div className={styles.tabSelectorWrapper}>
          <TabSelector 
            isOpen={showTabSelector}
            onClose={handleTabSelectorClose}
            filterQuery=""
          />
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <div className={styles.inputWrapper}>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            placeholder={getPlaceholder()}
            disabled={!isConnected}
            className={cn(
              styles.textarea,
              'min-h-[40px] resize-none pr-12'
            )}
            rows={1}
          />
          
          <Button
            type="submit"
            disabled={!isConnected || (!input.trim() && !isProcessing)}
            size="sm"
            className={cn(styles.sendButton, 'absolute right-2 bottom-2')}
            variant={isProcessing && !input.trim() ? 'destructive' : 'default'}
          >
            {isProcessing && !input.trim() ? 'Cancel' : 'Send'}
          </Button>
        </div>
      </form>
      
      <div className={cn(styles.inputHint, 'text-xs text-muted')}>
        {getHintText()}
      </div>
    </div>
  )
}