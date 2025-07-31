import React from 'react'
import { useMessageHandler } from './hooks/useMessageHandler'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore } from './stores/chatStore'

export function App() {
  // Initialize message handling
  useMessageHandler()
  
  // Get connection status from port messaging
  const { connected } = useSidePanelPortMessaging()
  
  // Get store state for debugging
  const { messages, isProcessing, error } = useChatStore()
  
  // For phase 1, just render a minimal UI to verify everything works
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h1 style={{ fontSize: '18px', marginBottom: '20px' }}>Sidepanel V2 - Phase 1</h1>
      
      {/* Connection status */}
      <div style={{ marginBottom: '10px' }}>
        Status: {connected ? '✅ Connected' : '❌ Disconnected'}
      </div>
      
      {/* Processing state */}
      <div style={{ marginBottom: '10px' }}>
        Processing: {isProcessing ? 'Yes' : 'No'}
      </div>
      
      {/* Error display */}
      {error && (
        <div style={{ 
          color: 'red', 
          marginBottom: '10px',
          padding: '10px',
          backgroundColor: '#fee',
          borderRadius: '4px'
        }}>
          Error: {error}
        </div>
      )}
      
      {/* Message count */}
      <div style={{ marginBottom: '20px' }}>
        Messages: {messages.length}
      </div>
      
      {/* Simple message list for debugging */}
      <div style={{ 
        flex: 1,
        overflow: 'auto',
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '10px'
      }}>
        {messages.length === 0 ? (
          <div style={{ color: '#999' }}>No messages yet...</div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              style={{ 
                marginBottom: '10px',
                padding: '8px',
                backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
                borderRadius: '4px'
              }}
            >
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                {msg.role.toUpperCase()} 
                {msg.metadata?.toolName && ` - ${msg.metadata.toolName}`}
                {msg.metadata?.error && ' - ERROR'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            </div>
          ))
        )}
      </div>
      
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        This is a minimal UI for Phase 1 testing. Full UI coming in Phase 2.
      </div>
    </div>
  )
}