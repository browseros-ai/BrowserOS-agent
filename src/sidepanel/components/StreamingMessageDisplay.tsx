import React, { useState, useEffect } from 'react'
import { z } from 'zod'
import styles from '../styles/components/StreamingMessageDisplay.module.scss'
import { cn } from '@/sidepanel/lib/utils'
import { MarkdownContent } from './MarkdownContent'

// Message type schema 
const MessageTypeSchema = z.enum(['user', 'system', 'llm', 'tool', 'error', 'streaming-llm', 'streaming-tool', 'thinking'])
export type MessageType = z.infer<typeof MessageTypeSchema>

// Message schema
const MessageSchema = z.object({
  id: z.string(),  // Unique message ID
  type: MessageTypeSchema,  // Message type
  content: z.string(),  // Message content
  toolName: z.string().optional(),  // Tool name if type is 'tool' or 'streaming-tool'
  toolArgs: z.any().optional(),  // Tool arguments if type is 'tool' or 'streaming-tool'
  isComplete: z.boolean().default(false),  // Whether message is complete
  timestamp: z.date()  // Message timestamp
})

export type Message = z.infer<typeof MessageSchema>

interface StreamingMessageDisplayProps {
  messages: Message[]
  className?: string
}

/**
 * Beautiful streaming message display component inspired by ChatGPT/Claude UI.
 * Shows messages with proper formatting and streaming animation.
 */
export function StreamingMessageDisplay({ 
  messages, 
  className 
}: StreamingMessageDisplayProps): JSX.Element {
  // HACK: Filter out "Aborted" error messages that slip through despite our error handling
  // This is a temporary fix - the root cause is that AbortError messages are still being
  // propagated somewhere in the chain despite our attempts to silence them
  const filteredMessages = messages.filter(message => {
    // Skip error messages that are just "Aborted" or contain only abort-related text
    if (message.type === 'error' && 
        (message.content === 'Aborted' || 
         message.content.toLowerCase() === 'aborted' ||
         message.content.includes('AbortError'))) {
      return false;
    }
    return true;
  });

  // Group messages by user messages and their subsequent execution messages
  const groupedMessages = React.useMemo(() => {
    const groups: Array<{
      userMessage: Message;
      executionMessages: Message[];
      finalMessage?: Message;
      isComplete: boolean;
    }> = [];

    let currentGroup: typeof groups[0] | null = null;

    filteredMessages.forEach((message) => {
      if (message.type === 'user') {
        // Start a new group with this user message
        currentGroup = {
          userMessage: message,
          executionMessages: [],
          isComplete: false
        };
        groups.push(currentGroup);
      } else if (currentGroup) {
        // Check if this is a completion message
        const isCompletionMessage = message.type === 'system' && (
          message.content.includes('✅ Task completed') ||
          message.content.includes('✋ Task paused') ||
          message.content.includes('❌ Task failed')
        );

        if (isCompletionMessage) {
          currentGroup.finalMessage = message;
          currentGroup.isComplete = true;
        } else {
          // Add to execution messages if it's not a completion message
          currentGroup.executionMessages.push(message);
        }
      }
    });

    return groups;
  }, [filteredMessages]);

  return (
    <div className={cn(styles.container, className)}>
      {groupedMessages.map((group, index) => (
        <MessageGroup 
          key={`group-${index}`}
          group={group}
          isLastGroup={index === groupedMessages.length - 1}
        />
      ))}
    </div>
  );
}

/**
 * Message group component that contains a user message and its execution messages
 */
function MessageGroup({ 
  group, 
  isLastGroup 
}: { 
  group: {
    userMessage: Message;
    executionMessages: Message[];
    finalMessage?: Message;
    isComplete: boolean;
  };
  isLastGroup: boolean;
}): JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-collapse when task completes
  useEffect(() => {
    if (group.isComplete) {
      setIsCollapsed(true);
    }
  }, [group.isComplete]);

  const hasExecutionMessages = group.executionMessages.length > 0;

  return (
    <div className={styles.messageGroup}>
      {/* User message */}
      <MessageItem message={group.userMessage} />

      {/* Collapsible execution messages */}
      {hasExecutionMessages && (
        <div className={styles.executionSection}>
          <button 
            className={styles.executionToggle}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-expanded={!isCollapsed}
          >
            <span className={styles.toggleIcon}>{isCollapsed ? '▶' : '▼'}</span>
            <span className={styles.toggleText}>
              {isCollapsed ? 'Show' : 'Hide'} execution details ({group.executionMessages.length} messages)
            </span>
          </button>
          
          {!isCollapsed && (
            <div className={styles.executionMessages}>
              {group.executionMessages.map((message, index) => {
                // Check if this is the last message and we're still executing
                const showSpinner = !group.isComplete && 
                  isLastGroup && 
                  index === group.executionMessages.length - 1 &&
                  message.type === 'system' &&
                  !message.content.includes('✋ Task paused') &&
                  !message.content.includes('✅ Task completed') &&
                  !message.content.includes('❌ Task failed');
                
                return (
                  <MessageItem 
                    key={message.id} 
                    message={message} 
                    showSystemSpinner={showSpinner}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Final message (outside collapsible) */}
      {group.finalMessage && (
        <MessageItem message={group.finalMessage} />
      )}
    </div>
  );
}

/**
 * Individual message item component
 */
function MessageItem({ 
  message, 
  showSystemSpinner = false 
}: { 
  message: Message; 
  showSystemSpinner?: boolean 
}): JSX.Element {
  // Don't render messages with no content
  if (!message.content && message.type !== 'streaming-tool' && message.type !== 'tool') {
    return <></>;
  }
  
  const getIcon = () => {
    switch (message.type) {
      case 'user':
        return '👤'
      case 'system':
        return '💭'  // Changed from 🚀 to 💭
      case 'thinking':
        return '💭'
      case 'llm':
      case 'streaming-llm':
        return '🤖'  // Changed from 🦊 to 🤖
      case 'tool':
      case 'streaming-tool':
        return '🛠️'
      case 'error':
        return '❌'
    }
  }

  const formatContent = () => {
    // Handle streaming tool messages
    if ((message.type === 'tool' || message.type === 'streaming-tool') && message.toolName) {
      return (
        <div className={styles.toolMessage}>
          <div className={styles.toolHeader}>
            <span className={styles.toolName}>{formatToolName(message.toolName)}</span>
            {message.toolArgs && (
              <span className={styles.toolArgs}>{formatToolArgs(message.toolName, message.toolArgs)}</span>
            )}
            {message.type === 'streaming-tool' && !message.isComplete && (
              <span className={styles.toolStatus}>
                <span className={styles.spinner}>⚡</span> Working...
              </span>
            )}
          </div>
          {message.content && (
            <div className={styles.toolResult}>
              {message.type === 'streaming-tool' && !message.isComplete ? (
                // Show raw streaming content for tools
                <pre className={styles.streamingContent}>{message.content}</pre>
              ) : (
                // Show formatted content for completed tools (compact for tool results)
                <MarkdownContent content={message.content} compact={true} />
              )}
            </div>
          )}
        </div>
      )
    }
    
    // Handle streaming LLM messages
    if (message.type === 'streaming-llm') {
      // Don't render empty streaming messages
      if (!message.content && !message.isComplete) {
        return null;
      }
      return (
        <div className={styles.messageText}>
          {!message.isComplete ? (
            // STREAMING: Render as plain text to avoid partial markdown issues
            <div className={styles.streamingContent}>
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                fontFamily: 'inherit',  // Use same font as rest of UI
                margin: 0,
                padding: 0,
                background: 'transparent',
                border: 'none',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                color: 'inherit'
              }}>
                {message.content}
              </pre>
              <span className={styles.cursor}>|</span>
            </div>
          ) : (
            // COMPLETE: Render as markdown
            <MarkdownContent content={message.content} />
          )}
        </div>
      )
    }
    
    // Use MarkdownContent for completed messages
    return (
      <div className={styles.messageText}>
        <MarkdownContent 
          content={message.content} 
          skipMarkdown={message.type === 'user'}
        />
        {showSystemSpinner && (
          <span className={styles.systemStatus}>
            <span className={styles.systemSpinner}>⚡</span> Working...
          </span>
        )}
      </div>
    )
  }

  // Map streaming types to their final types for styling
  const getMessageTypeClass = () => {
    if (message.type === 'streaming-llm') return 'llm'
    if (message.type === 'streaming-tool') return 'tool'
    if (message.type === 'thinking') return 'system'  // Style thinking messages like system messages
    return message.type
  }

  return (
    <div className={cn(
      styles.message, 
      styles[`message--${getMessageTypeClass()}`],
      message.isComplete && styles['message--complete'],
      (message.type === 'streaming-llm' || message.type === 'streaming-tool') && styles['message--streaming']
    )}>
      <div className={styles.messageIcon}>
        <span className={styles[`${getMessageTypeClass()}Icon`]}>{getIcon()}</span>
      </div>
      <div className={styles.messageContent}>
        {formatContent()}
      </div>
    </div>
  )
}

/**
 * Format tool name for display
 */
function formatToolName(toolName: string): string {
  // The tool name is now already user-friendly from the BrowserAgent
  return toolName;
}

/**
 * Format tool arguments for display (now expects clean data)
 */
function formatToolArgs(toolName: string, args: any): string {
  if (!args) return '';
  
  // Args are now cleaned up by the BrowserAgent, so just display them
  if (typeof args === 'string') {
    return args;
  }
  
  // If it's an object with a description, use that
  if (args.description) {
    return args.description;
  }
  
  // Otherwise, try to extract meaningful info
  if (args.target) return args.target;
  if (args.text) return `"${args.text}"`;
  if (args.key) return args.key;
  if (args.selector) return args.selector;
  
  return '';
}

 
