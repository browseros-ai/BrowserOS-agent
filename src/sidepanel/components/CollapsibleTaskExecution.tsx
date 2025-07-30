import React, { useState, useEffect } from 'react'
import { cn } from '@/sidepanel/lib/utils'
import styles from '../styles/components/CollapsibleTaskExecution.module.scss'
import { Message } from './StreamingMessageDisplay'

interface CollapsibleTaskExecutionProps {
  taskId: string
  status: 'executing' | 'completed' | 'failed'
  messages: Message[]
  isExpanded: boolean
  onToggle: (taskId: string, expanded: boolean) => void
  finalResult?: string  // Final result to show when collapsed
}

/**
 * Collapsible container for task execution details.
 * Shows execution progress during task and auto-collapses when complete.
 */
export function CollapsibleTaskExecution({ 
  taskId,
  status,
  messages,
  isExpanded,
  onToggle,
  finalResult
}: CollapsibleTaskExecutionProps): JSX.Element {
  // Handle click on header
  const handleToggle = () => {
    onToggle(taskId, !isExpanded)
  }
  
  // Get header text based on status
  const getHeaderText = () => {
    switch(status) {
      case 'executing': 
        return 'Executing task...'
      case 'completed': 
        return finalResult || 'Task completed ✓'
      case 'failed': 
        return 'Task failed ✗'
    }
  }
  
  // Get header icon
  const getStatusIcon = () => {
    switch(status) {
      case 'executing': 
        return <span className={styles.spinner}>⚡</span>
      case 'completed': 
        return <span className={styles.success}>✓</span>
      case 'failed': 
        return <span className={styles.error}>✗</span>
    }
  }
  
  return (
    <div className={cn(
      styles.container,
      styles[`container--${status}`]
    )}>
      {/* Header - Always visible */}
      <div 
        className={styles.header} 
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggle()
          }
        }}
      >
        <span className={cn(
          styles.arrow,
          !isExpanded && styles['arrow--collapsed']
        )}>
          ▼
        </span>
        <span className={styles.headerText}>{getHeaderText()}</span>
        {getStatusIcon()}
      </div>
      
      {/* Collapsible content */}
      {isExpanded && (
        <div className={styles.content}>
          {messages.map((msg, index) => (
            <div 
              key={msg.id || `${taskId}-${index}`} 
              className={styles.executionMessage}
            >
              <span className={styles.messageIcon}>
                {msg.type === 'thinking' || msg.type === 'system' ? '💭' : '🛠️'}
              </span>
              <span className={styles.messageText}>{msg.content}</span>
            </div>
          ))}
          
          {/* Show spinner if still executing */}
          {status === 'executing' && messages.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.spinner}>⚡</span>
              <span>Starting execution...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}