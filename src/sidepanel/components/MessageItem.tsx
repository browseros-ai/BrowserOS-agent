import React, { memo, useEffect, useState, useMemo, useCallback } from 'react'
import { MarkdownContent } from './shared/Markdown'
import { ExpandableSection } from './shared/ExpandableSection'
import { cn } from '@/sidepanel/lib/utils'
import type { Message } from '../stores/chatStore'
import { useChatStore } from '../stores/chatStore'
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { TaskManagerDropdown } from './TaskManagerDropdown'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'
import { useCopyToClipboard } from '@/sidepanel/hooks/useCopyToClipboard'

interface MessageItemProps {
  message: Message
  shouldIndent?: boolean
  showLocalIndentLine?: boolean  // When true, renders per-item vertical line
  applyIndentMargin?: boolean  // Control whether to apply left margin for indent
}

// Helper function to detect and parse JSON content from message
const parseJsonContent = (content: string) => {
  try {
    let trimmedContent = content.trim()
    
    // Handle quoted JSON strings (e.g., "[{...}]" or '{"key": "value"}')
    if ((trimmedContent.startsWith('"') && trimmedContent.endsWith('"')) ||
        (trimmedContent.startsWith("'") && trimmedContent.endsWith("'"))) {
      // Remove the outer quotes and try to parse the inner JSON
      trimmedContent = trimmedContent.slice(1, -1)
      // Handle escaped quotes
      trimmedContent = trimmedContent.replace(/\\"/g, '"')
    }
    
    // Check if content looks like JSON (starts with [ or {)
    if (trimmedContent.startsWith('[') || trimmedContent.startsWith('{')) {
      const parsed = JSON.parse(trimmedContent)
      return parsed
    }
    return null
  } catch {
    return null
  }
}

// Helper function to check if JSON contains browser tab data
const isTabData = (data: any): data is Array<{id: number, url: string, title: string, windowId: number}> => {
  return Array.isArray(data) && 
         data.length > 0 && 
         data.every(item => 
           typeof item === 'object' && 
           typeof item.id === 'number' && 
           typeof item.url === 'string' && 
           typeof item.title === 'string' && 
           typeof item.windowId === 'number'
         )
}

// Helper function to check if JSON contains selected tab data (without windowId)
const isSelectedTabData = (data: any): data is Array<{id: number, url: string, title: string}> => {
  return Array.isArray(data) && 
         data.length > 0 && 
         data.every(item => 
           typeof item === 'object' && 
           typeof item.id === 'number' && 
           typeof item.url === 'string' && 
           typeof item.title === 'string'
         )
}

// TabDataDisplay component for rendering tab information
interface TabDataDisplayProps {
  content: string
}

const TabDataDisplay = ({ content }: TabDataDisplayProps) => {
  const tabData = parseJsonContent(content)
  
  if (!tabData || !isTabData(tabData)) {
    return (
      <div className="text-sm text-muted-foreground">
        Invalid tab data format
      </div>
    )
  }

  // Group tabs by window
  const tabsByWindow = tabData.reduce((acc, tab) => {
    if (!acc[tab.windowId]) {
      acc[tab.windowId] = []
    }
    acc[tab.windowId].push(tab)
    return acc
  }, {} as Record<number, typeof tabData>)

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-foreground mb-3">
        Found {tabData.length} tab{tabData.length !== 1 ? 's' : ''} across {Object.keys(tabsByWindow).length} window{Object.keys(tabsByWindow).length !== 1 ? 's' : ''}
      </div>
      <ExpandableSection itemCount={tabData.length} threshold={6} collapsedMaxHeight={224}>
        {Object.entries(tabsByWindow).map(([windowId, tabs]) => (
          <div key={windowId} className="tab-card bg-muted/50 rounded-lg p-3">
            <div className="space-y-2">
              {tabs.map((tab) => (
                <div 
                  key={tab.id} 
                  className="flex items-start gap-3 p-2 bg-background/50 rounded hover:bg-background/70 transition-colors"
                >
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-brand/60 mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate" title={tab.title}>
                      {tab.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={tab.url}>
                      {tab.url}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </ExpandableSection>
    </div>
  )
}

// SelectedTabDataDisplay component for rendering selected tab information
interface SelectedTabDataDisplayProps {
  content: string
}

const SelectedTabDataDisplay = ({ content }: SelectedTabDataDisplayProps) => {
  const tabData = parseJsonContent(content)
  
  if (!tabData || !isSelectedTabData(tabData)) {
    return (
      <div className="text-sm text-muted-foreground">
        Invalid selected tab data format
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-foreground mb-3">
        Selected {tabData.length} tab{tabData.length !== 1 ? 's' : ''}
      </div>
      <ExpandableSection itemCount={tabData.length} threshold={6} collapsedMaxHeight={224}>
        <div className="tab-card bg-muted/50 rounded-lg p-3">
          <div className="space-y-2">
            {tabData.map((tab) => (
              <div 
                key={tab.id} 
                className="flex items-start gap-3 p-2 bg-background/50 rounded hover:bg-background/70 transition-colors"
              >
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-brand/60 mt-2"></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate" title={tab.title}>
                    {tab.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" title={tab.url}>
                    {tab.url}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ExpandableSection>
    </div>
  )
}

// Extracted items (links/headlines) minimal display
interface ExtractedItemsDisplayProps { content: string }

type ExtractedLink = { source?: string, url: string }

const urlRegex = /https?:\/\/[^\s)>,]+/g

const sanitizeUrl = (u: string): string => {
  return u.replace(/[),]+$/g, '')
}

const parseExtractedLinks = (content: string): ExtractedLink[] => {
  const results: ExtractedLink[] = []
  if (!content) return results
  const labelRegex = /([A-Z][A-Za-z0-9 .&-]{1,50}):/g
  const segments: Array<{ label?: string, text: string }> = []
  let match: RegExpExecArray | null
  const labels: Array<{ label: string, index: number }> = []
  while ((match = labelRegex.exec(content)) !== null) {
    labels.push({ label: match[1].trim(), index: match.index })
  }
  if (labels.length === 0) {
    const urls = content.match(urlRegex) || []
    urls.forEach(u => results.push({ url: sanitizeUrl(u) }))
    return results
  }
  labels.forEach((l, i) => {
    const start = l.index + l.label.length + 1
    const end = i + 1 < labels.length ? labels[i + 1].index : content.length
    const text = content.slice(start, end)
    const urls = text.match(urlRegex) || []
    urls.forEach(u => results.push({ source: l.label, url: sanitizeUrl(u) }))
  })
  return results
}

const parseExtractedHeadlines = (content: string): string[] => {
  return content
    .split(/\r?\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !urlRegex.test(s))
}

const shortenUrl = (u: string): string => {
  try {
    const parsed = new URL(u)
    return parsed.host
  } catch {
    return u
  }
}

const ExtractedItemsDisplay = ({ content }: ExtractedItemsDisplayProps) => {
  const links = parseExtractedLinks(content)
  const headlines = links.length === 0 ? parseExtractedHeadlines(content) : []
  type Item = { primary: string, secondary?: string }
  const items: Item[] = links.length > 0 
    ? links.map(l => ({ primary: l.source || shortenUrl(l.url), secondary: l.url }))
    : headlines.map(h => ({ primary: h }))

  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">No extracted content</div>
  }

  return (
    <div className="space-y-1">
      <ExpandableSection itemCount={items.length} threshold={6} collapsedMaxHeight={192}>
        <div className="extract-card bg-muted/50 rounded-lg p-2">
          <div className="space-y-1">
            {items.map((it, idx) => (
              <details key={`${it.primary}-${idx}`} className="group">
                <summary className="cursor-pointer list-none text-sm text-foreground flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand/60" />
                  <span className="truncate">
                    {it.secondary ? `${it.primary} — ${shortenUrl(it.secondary)}` : it.primary}
                  </span>
                </summary>
                <div className="mt-1 ml-4 text-xs text-muted-foreground break-words">
                  {it.secondary ? (
                    <a href={it.secondary} target="_blank" rel="noreferrer" className="underline">{it.secondary}</a>
                  ) : (
                    <span className="whitespace-pre-wrap">{it.primary}</span>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      </ExpandableSection>
    </div>
  )
}

// Defaults
const AUTO_COLLAPSE_DELAY_MS = 10000  // Auto-collapse delay for indented tool messages

// Inline collapsible tool result (super subtle, no background)
interface ToolResultInlineProps { name: string, content: string, autoCollapseAfterMs?: number }

const ToolResultInline = ({ name, content, autoCollapseAfterMs }: ToolResultInlineProps) => {
  const [expanded, setExpanded] = useState<boolean>(true)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Reset and (re)schedule collapse when content/name or delay changes
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const isEnabled = typeof autoCollapseAfterMs === 'number' && autoCollapseAfterMs > 0
    if (isEnabled) {
      setExpanded(true)
      timerRef.current = setTimeout(() => {
        // Simple guard: if setting is off at fire time, do nothing
        if (!useSettingsStore.getState().autoCollapseTools) return
        setExpanded(false)
        timerRef.current = null
      }, autoCollapseAfterMs)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [autoCollapseAfterMs, name, content])

  return (
    <div className="flex flex-col gap-0.5 select-text">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] uppercase tracking-wide text-muted-foreground/80 leading-tight inline-flex items-center gap-1 cursor-pointer focus:outline-none"
      >
        <span>{name}</span>
        <span className="shrink-0 text-muted-foreground/70">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>

      {expanded && (
        <div className="text-sm text-muted-foreground font-medium">
          {content || ''}
        </div>
      )}
    </div>
  )
}

/**
 * MessageItem component
 * Simplified role-based rendering with direct PubSub message mapping
 * Memoized to prevent re-renders when message hasn't changed
 */
export const MessageItem = memo<MessageItemProps>(function MessageItem({ message, shouldIndent = false, showLocalIndentLine = false, applyIndentMargin = true }: MessageItemProps) {
  const { autoCollapseTools } = useSettingsStore()
  const messages = useChatStore(state => state.messages)
  const { copyToClipboard, isCopied } = useCopyToClipboard()
  
  // Check if this is the latest thinking message (for shimmer effect)
  const isLatestThinking = useMemo(() => {
    if (message.role !== 'thinking') return false
    const lastMessage = messages[messages.length - 1]
    return lastMessage?.msgId === message.msgId
  }, [message.role, message.msgId, messages])
  
  // Check if this is the latest narration message (for shimmer effect)
  const isLatestNarration = useMemo(() => {
    if (message.role !== 'narration') return false
    const lastMessage = messages[messages.length - 1]
    return lastMessage?.msgId === message.msgId
  }, [message.role, message.msgId, messages])
  
  // Handle copy action for assistant messages
  const handleCopyMessage = useCallback(async () => {
    if (message.role === 'assistant') {
      await copyToClipboard(message.content)
    }
  }, [message.role, message.content, copyToClipboard])
  
  // Simple role checks
  const isUser = message.role === 'user'
  const isError = message.role === 'error'
  const isThinking = message.role === 'thinking'
  const isNarration = message.role === 'narration'
  const isAssistant = message.role === 'assistant'
  
  // Special cases we still need to detect
  const isTodoTable = message.content.includes('| # | Status | Task |')

  // Dynamic message styling based on role and content type
  const messageStyling = useMemo(() => {
    // User message styling
    if (isUser) {
      return {
        bubble: 'ml-4 bg-brand text-white rounded-br-md',
        glow: '',
        shadow: ''
      }
    }

    // Special styling for TODO lists (task manager)
    if (isTodoTable) {
      return {
        bubble: 'mr-4 bg-card text-foreground rounded-bl-md',
        glow: '',
        shadow: ''
      }
    }

    // No bubble for other message types
    return null
  }, [isUser, isTodoTable])

  // Simplified: determine if we should show a bubble
  const shouldShowBubble = isUser || isTodoTable
  
  // Render content based on message role and special data types
  const renderContent = useCallback(() => {
    // Special case: TODO table
    if (isTodoTable) {
      return <TaskManagerDropdown 
        key={`task-manager-${message.msgId}`} 
        content={message.content}
        isEditable={false}
      />
    }

    // Special case: Check for tab data
    const jsonData = parseJsonContent(message.content)
    if (jsonData) {
      if (isTabData(jsonData)) {
        return <TabDataDisplay content={message.content} />
      }
      if (isSelectedTabData(jsonData)) {
        return <SelectedTabDataDisplay content={message.content} />
      }
    }

    // Role-based rendering
    switch (message.role) {
      case 'user':
        return (
          <div className="whitespace-pre-wrap break-words font-medium">
            {message.content}
          </div>
        )

      case 'thinking':
        // Check if this is a tool result (simple heuristic)
        if (message.metadata?.toolName || message.content.includes('_tool')) {
          const toolName = message.metadata?.toolName || 'tool'
          return (
            <ToolResultInline
              name={toolName}
              content={message.content}
              autoCollapseAfterMs={autoCollapseTools && shouldIndent ? AUTO_COLLAPSE_DELAY_MS : undefined}
            />
          )
        }
        // Regular thinking message - use shimmer if it's the latest
        if (isLatestThinking && !isTodoTable) {
          return (
            <div className="shimmer-container">
              <MarkdownContent
                content={message.content}
                className="break-words"
                compact={false}
              />
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-background/30 to-transparent animate-shimmer bg-[length:200%_100%]" />
            </div>
          )
        }
        // Regular thinking message - use markdown
        return (
          <MarkdownContent
            content={message.content}
            className="break-words"
            compact={false}
          />
        )

      case 'narration':
        // Narration messages with shimmer effect if latest
        if (isLatestNarration && !isTodoTable) {
          return (
            <div className="shimmer-container">
              <MarkdownContent
                content={message.content}
                className="break-words text-muted-foreground"
                compact={false}
              />
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-background/30 to-transparent animate-shimmer bg-[length:200%_100%]" />
            </div>
          )
        }
        // Regular narration message
        return (
          <MarkdownContent
            content={message.content}
            className="break-words text-muted-foreground"
            compact={false}
          />
        )

      case 'assistant':
        // Final results - rich markdown with emphasis
        return (
          <div className="space-y-3">
            <MarkdownContent
              content={message.content}
              className="break-words font-semibold"
              compact={false}
            />
          </div>
        )

      case 'error':
        // Error messages with red styling
        return (
          <div className="text-red-500 font-medium">
            <MarkdownContent
              content={message.content}
              className="break-words"
              compact={false}
            />
          </div>
        )

      case 'plan_editor':
        try {
          const planData = JSON.parse(message.content)
          
          return (
            <TaskManagerDropdown
              content={planData.steps.map((step: any) => 
                `- [ ] ${step.action}`
              ).join('\n')}
              isEditable={planData.isPreview !== false}  // Only editable if in preview mode
              onTasksChange={(tasks: any[]) => {
                const updatedSteps = tasks.map((task: any, index: number) => ({
                  id: task.id,
                  action: task.content,
                  reasoning: '',
                  order: index,
                  isEditable: true
                }))
              }}
              onExecute={(tasks: any[]) => {
                const steps = tasks.map((task: any, index: number) => ({
                  id: task.id,
                  action: task.content,
                  reasoning: '',
                  order: index,
                  isEditable: false
                }))
                
                useChatStore.getState().publishPlanEditResponse({
                  planId: planData.planId,
                  action: 'execute',
                  steps: steps
                })
              }}
              onCancel={() => {
                useChatStore.getState().publishPlanEditResponse({
                  planId: planData.planId,
                  action: 'cancel'
                })
              }}
            />
          )
        } catch (error) {
          return (
            <div className="text-red-500 text-sm">
              Error rendering plan editor: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          );
        }

      default:
        // Fallback to markdown
        return (
          <MarkdownContent
            content={message.content}
            className="break-words"
            compact={false}
          />
        )
    }
  }, [message.role, message.content, message.msgId, message.metadata?.toolName, isTodoTable, autoCollapseTools, shouldIndent, isLatestThinking, isLatestNarration])

  return (
    <div 
      data-message-id={message.msgId}
      className={cn(
        'flex w-full group message-container',
        isUser ? 'justify-end' : 'justify-start',
        // Add indentation for messages that should be indented
        shouldIndent && 'ml-8 relative',
        // Add special styling for TODO table messages
        isTodoTable && 'relative'
      )}
    >
      
      {/* Vertical connecting line for indented messages (used only when not grouped) */}
      {shouldIndent && showLocalIndentLine && (
        <div className="absolute left-[-16px] top-0 bottom-0 w-px bg-gradient-to-b from-brand/30 via-brand/20 to-brand/10" />
      )}

      {/* Task manager indicators - these will be handled by parent component data attributes */}
      {/* Removed DOM queries for these - they're now handled by parent component */}


      {/* Message content - with or without bubble */}
      {shouldShowBubble ? (
        // Message bubble layout
        <div className={cn(
          'relative max-w-[85%] rounded-2xl px-3 py-1 transition-all duration-300',
          messageStyling?.shadow,
          messageStyling?.bubble,
          // Slightly darker text for indented bubble messages to improve contrast
          shouldIndent && 'opacity-90 text-foreground'
        )}>
          {/* Glow effect */}
          {messageStyling?.glow && (
            <div className={cn(
              'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300',
              messageStyling.glow
            )} />
          )}

          {/* Content */}
          <div className="relative z-10">
            {renderContent()}
          </div>

          {/* Timestamp - only show for user and TODO messages */}
          {(isUser || isTodoTable) && (
            <div className={cn('text-xs opacity-50', isUser ? 'text-right' : 'text-left')}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      ) : (
        // Non-bubble messages (thinking, assistant, error)
        <div className={cn(
          'mr-4 max-w-[85%] relative group',
          'mt-1',
          // Add subtle styling for indented messages
          shouldIndent && 'opacity-90',
          // Error messages get special styling
          isError && 'text-red-500'
        )}>
          <div className="text-sm">
            {renderContent()}
          </div>
          
          {/* Copy button for assistant messages */}
          {message.role === 'assistant' && (
            <button
              onClick={handleCopyMessage}
              className={cn(
                'absolute top-1 right-1 p-1.5 rounded-md transition-all duration-200',
                'opacity-0 group-hover:opacity-100',
                'hover:bg-muted/80 active:bg-muted',
                'text-muted-foreground hover:text-foreground',
                'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand/20'
              )}
              title={isCopied ? 'Copied!' : 'Copy response'}
              aria-label={isCopied ? 'Copied to clipboard' : 'Copy response to clipboard'}
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
})