import React from 'react'
import { Header } from './Header'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useChatStore } from '../stores/chatStore'

interface ChatProps {
  isConnected: boolean
}

/**
 * Main chat container component
 * Orchestrates the layout and manages the overall chat interface
 */
export function Chat({ isConnected }: ChatProps) {
  const { messages, isProcessing, reset } = useChatStore()

  return (
    <div className="flex flex-col h-full bg-background">
      <Header 
        onReset={reset}
        showReset={messages.length > 0}
        isProcessing={isProcessing}
      />
      
      <MessageList messages={messages} />
      
      <ChatInput 
        isConnected={isConnected}
        isProcessing={isProcessing}
      />
    </div>
  )
}