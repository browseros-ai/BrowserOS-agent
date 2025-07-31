import React from 'react'
import { Header } from './Header'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { cn } from '@/sidepanel/lib/utils'
import { useChatStore } from '../stores/chatStore'
import styles from '../styles/components/Chat.module.scss'

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
    <div className={cn(styles.chatContainer, 'flex flex-col h-full')}>
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