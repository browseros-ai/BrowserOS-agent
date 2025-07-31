import React from 'react'
import { Header } from './Header'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useChatStore } from '../stores/chatStore'
import { ErrorBoundary } from './ErrorBoundary'

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
      
      <ErrorBoundary
        fallback={(error, reset) => (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 mb-2">Failed to load messages</p>
              <button 
                onClick={reset}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      >
        <main id="main-content">
          <MessageList messages={messages} />
        </main>
      </ErrorBoundary>
      
      <ErrorBoundary
        fallback={(error, reset) => (
          <div className="p-4 bg-red-50 dark:bg-red-950/20">
            <p className="text-sm text-red-600 dark:text-red-400">
              Input error. <button onClick={reset} className="underline">Reset</button>
            </p>
          </div>
        )}
      >
        <ChatInput 
          isConnected={isConnected}
          isProcessing={isProcessing}
        />
      </ErrorBoundary>
    </div>
  )
}