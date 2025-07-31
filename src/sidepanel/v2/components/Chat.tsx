import React from 'react'
import { Header } from './Header'
import { MessageList } from './MessageList'
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
      
      {/* ChatInput will be added in phase 3 */}
      <div className={cn(styles.inputPlaceholder, 'p-4 border-t')}>
        <div className="text-center text-sm text-gray-500">
          {isConnected ? 'Input component coming in phase 3' : 'Disconnected'}
        </div>
      </div>
    </div>
  )
}