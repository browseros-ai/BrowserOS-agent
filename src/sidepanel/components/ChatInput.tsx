import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Textarea } from '@/sidepanel/components/ui/textarea'
import { Button } from '@/sidepanel/components/ui/button'
import { LazyTabSelector } from './LazyTabSelector'
import { useTabsStore, BrowserTab } from '@/sidepanel/stores/tabsStore'
import { useChatStore } from '../stores/chatStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useKeyboardShortcuts, useAutoResize } from '../hooks/useKeyboardShortcuts'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { cn } from '@/sidepanel/lib/utils'
import { Loader } from 'lucide-react'
import { BrowserOSProvidersConfig, BrowserOSProvider } from '@/lib/llm/settings/browserOSTypes'
import { ModeToggle } from './ModeToggle'
// Tailwind classes used in ModeToggle; no separate CSS import
import { SlashCommandPalette } from './SlashCommandPalette'
import { useAgentsStore } from '@/newtab/stores/agentsStore'


interface ChatInputProps {
  isConnected: boolean
  isProcessing: boolean
  onToggleSelectTabs: () => void
  showSelectTabsButton: boolean
}

/**
 * Chat input component with auto-resize, tab selection, and keyboard shortcuts
 */
export function ChatInput({ isConnected, isProcessing }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [showTabSelector, setShowTabSelector] = useState(false)
  const [showSlashPalette, setShowSlashPalette] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [providerOk, setProviderOk] = useState<boolean>(true)
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const [draftBeforeHistory, setDraftBeforeHistory] = useState<string>('')
  
  const { upsertMessage, setProcessing } = useChatStore()
  const messages = useChatStore(state => state.messages)
  const { chatMode } = useSettingsStore()
  const { sendMessage, addMessageListener, removeMessageListener, connected: portConnected } = useSidePanelPortMessaging()
  const { getContextTabs, toggleTabSelection, clearSelectedTabs } = useTabsStore()
  const { agents, loadAgents } = useAgentsStore()
  
  // Load agents from Chrome storage on mount
  useEffect(() => {
    chrome.storage.local.get('agents', (result) => {
      if (result.agents && Array.isArray(result.agents)) {
        loadAgents(result.agents)
      } else {
        loadAgents([])
      }
    })
  }, [])  // Remove loadAgents dependency to avoid re-runs
  
  // Provider health: only consider UI connected if current default provider is usable
  useEffect(() => {
    const computeOk = (cfg: BrowserOSProvidersConfig) => {
      const def = cfg.providers.find(p => p.id === cfg.defaultProviderId)
      setProviderOk(isProviderUsable(def || null))
    }

    const handleWorkflow = (payload: any) => {
      // Only update when explicit providers config is present
      if (payload && payload.data && payload.data.providersConfig) {
        computeOk(payload.data.providersConfig as BrowserOSProvidersConfig)
      }
    }

    addMessageListener<any>(MessageType.WORKFLOW_STATUS, handleWorkflow)
    return () => removeMessageListener<any>(MessageType.WORKFLOW_STATUS, handleWorkflow)
  }, [addMessageListener, removeMessageListener])

  const isProviderUsable = (provider: BrowserOSProvider | null): boolean => {
    // If the provider exists in the list, treat it as usable regardless of field completeness
    return !!provider
  }

  const connectionOk = isConnected || portConnected
  const uiConnected = connectionOk && providerOk
  
  // Auto-resize textarea
  useAutoResize(textareaRef, input)

  const userHistory: string[] = useMemo(() => {
    return messages.filter(m => m.role === 'user').map(m => m.content)
  }, [messages])
  
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
    
    if (!uiConnected) {
      // Show error message in chat
      const msg = !connectionOk
        ? 'Cannot send message: Extension is disconnected'
        : 'Cannot send message: Provider not configured'
      upsertMessage({ 
        msgId: `error_${Date.now()}`,
        role: 'error', 
        content: msg,
        ts: Date.now()
      })
      return
    }
    
    // Add user message via upsert
    upsertMessage({
      msgId: `user_${Date.now()}`,
      role: 'user',
      content: query,
      ts: Date.now()
    })
    
    // Add a "Thinking..." narration message immediately after user query
    upsertMessage({
      msgId: `thinking_${Date.now()}`,
      role: 'thinking',
      content: 'Thinking...',
      ts: Date.now()
    })
    
    // Get selected tab IDs from tabsStore
    const contextTabs = getContextTabs()
    const tabIds = contextTabs.length > 0 ? contextTabs.map(tab => tab.id) : undefined
    
    // Send to background
    setProcessing(true)
    sendMessage(MessageType.EXECUTE_QUERY, {
      query: query.trim(),
      tabIds,
      source: 'sidepanel',
      chatMode  // Include chat mode setting
    })
    
    // Clear input and selected tabs
    setInput('')
    setHistoryIndex(-1)
    setDraftBeforeHistory('')
    clearSelectedTabs()
    setShowTabSelector(false)
  }
  
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    // Block submissions while processing
    if (isProcessing) return
    // Don't submit while slash palette is open
    if (showSlashPalette) return
    if (!input.trim()) return
    submitTask(input)
  }
  
  const handleCancel = () => {
    sendMessage(MessageType.CANCEL_TASK, {
      reason: 'User requested cancellation',
      source: 'sidepanel'
    })
    // Do not change local processing state here; wait for background WORKFLOW_STATUS
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setInput(newValue)
    // Toggle slash palette when user types '/'
    if (newValue === '/' || (newValue.startsWith('/') && newValue.length > 0)) {
      if (!showSlashPalette) {
        setShowSlashPalette(true)
      }
    } else if (showSlashPalette) {
      setShowSlashPalette(false)
    }
    // Only show selector when user just typed '@' starting a new token
    const lastChar: string = newValue.slice(-1)
    if (lastChar === '@' && !showTabSelector) {
      const beforeAt: string = newValue.slice(0, -1)
      if (beforeAt === '' || /\s$/.test(beforeAt)) {
        setShowTabSelector(true)
      }
      return
    }
    // Hide selector when input cleared
    if (newValue === '' && showTabSelector) {
      setShowTabSelector(false)
    }
  }

  const moveCaretToEnd = (): void => {
    const ta = textareaRef.current
    if (!ta) return
    const len: number = input.length
    ta.focus()
    ta.setSelectionRange(len, len)
  }

  // Handle ArrowUp/ArrowDown history navigation when caret is at boundaries
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (showTabSelector || showSlashPalette) return
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const ta = textareaRef.current
    if (!ta) return
    const atStart: boolean = ta.selectionStart === 0 && ta.selectionEnd === 0
    const atEnd: boolean = ta.selectionStart === input.length && ta.selectionEnd === input.length

    if (e.key === 'ArrowUp' && !e.shiftKey) {
      if (!atStart) return
      if (userHistory.length === 0) return
      e.preventDefault()
      if (historyIndex === -1) setDraftBeforeHistory(input)
      const nextIndex: number = historyIndex === -1 ? userHistory.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(nextIndex)
      setInput(userHistory[nextIndex] || '')
      requestAnimationFrame(moveCaretToEnd)
      return
    }

    if (e.key === 'ArrowDown' && !e.shiftKey) {
      if (!atEnd) return
      if (userHistory.length === 0) return
      if (historyIndex === -1) return
      e.preventDefault()
      const nextIndex: number = historyIndex + 1
      if (nextIndex >= userHistory.length) {
        setHistoryIndex(-1)
        setInput(draftBeforeHistory)
      } else {
        setHistoryIndex(nextIndex)
        setInput(userHistory[nextIndex] || '')
      }
      requestAnimationFrame(moveCaretToEnd)
    }
  }
  
  const handleTabSelectorClose = () => {
    setShowTabSelector(false)
    textareaRef.current?.focus()
  }

  const handleTabSelected = (_tabId: number) => {
    // Remove trailing '@' that triggered the selector
    setInput(prev => prev.replace(/@$/, ''))
  }

  const handleRemoveSelectedTab = (tabId: number): void => {
    toggleTabSelection(tabId)
  }

  const selectedContextTabs: BrowserTab[] = getContextTabs()
  
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
    if (!connectionOk) return 'Disconnected'
    if (!providerOk) return 'Provider error'
    if (isProcessing) return 'Task running…'
    return chatMode ? 'Ask about this page...' : 'Ask me anything... (/ to pick an agent)'
  }
  
  const getHintText = () => {
    if (!connectionOk) return 'Waiting for connection'
    if (!providerOk) return 'Provider not configured'
    if (isProcessing) return 'Task running… Press Esc to cancel'
    return chatMode 
      ? 'Chat mode is for simple Q&A • @ to select tabs • Press Enter to send'
      : 'Agent mode is for complex web navigation tasks • Press Enter to send'
  }

  
  return (
    <div className="relative bg-[hsl(var(--header))] border-t border-border/50 px-2 py-1 flex-shrink-0 overflow-hidden z-20">
      
      {/* Mode Toggle - top left, above input */}
      <div className="px-2 mb-2">
        <ModeToggle />
      </div>

      {/* Input container */}
      <div className="relative">
        {/* Toggle Select Tabs Button */}
        {/* <div className="flex justify-center mb-2">
          <Button
            type="button"
            onClick={onToggleSelectTabs}
            size="sm"
            variant="ghost"
            className="h-6 px-3 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 text-xs"
            aria-label={showSelectTabsButton ? 'Hide tab selector' : 'Show tab selector'}
          >
            <TabsIcon />
            {showSelectTabsButton ? 'Hide Tabs' : 'Show Tabs'}
          </Button>
        </div> */}
        
        {/* Selected tabs chips */}
        {selectedContextTabs.length > 0 && (
          <div className="px-2 mb-1">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {selectedContextTabs.map(tab => (
                <div
                  key={tab.id}
                  className="selected-tab-chip flex items-center gap-2 pl-2 pr-1 py-1 rounded-full bg-muted text-foreground/90 border border-border shadow-sm shrink-0"
                  title={tab.title}
                >
                  <div className="w-4 h-4 rounded-sm overflow-hidden bg-muted-foreground/10 flex items-center justify-center">
                    {tab.favIconUrl ? (
                      <img src={tab.favIconUrl} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-muted-foreground/20" />
                    )}
                  </div>
                  <span className="text-xs max-w-[140px] truncate">
                    {tab.title}
                  </span>
                  <button
                    type="button"
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-foreground/10 text-xs text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${tab.title} from selection`}
                    onClick={() => handleRemoveSelectedTab(tab.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showTabSelector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <LazyTabSelector
              isOpen={showTabSelector}
              onClose={handleTabSelectorClose}
              onTabSelect={handleTabSelected}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full px-2" role="form" aria-label="Chat input form">
          <div className="relative flex items-end w-full transition-all duration-300 ease-out">
            {/* Textarea grows to fill available width */}
            <div className="relative flex-1">
              <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              disabled={!uiConnected}
              className={cn(
                'max-h-[200px] resize-none pr-16 text-sm w-full',
                'bg-background/80 backdrop-blur-sm border-2 border-brand/30',
                'focus-visible:outline-none focus-visible:border-brand/60',
                'focus:outline-none focus:border-brand/60',
                'hover:border-brand/50 hover:bg-background/90',
                'rounded-2xl shadow-lg',
                'px-3 py-2',
                'transition-all duration-300 ease-out',
                 !uiConnected && 'opacity-50 cursor-not-allowed bg-muted'
              )}
              rows={1}
              aria-label="Chat message input"
              aria-describedby="input-hint"
               aria-invalid={!uiConnected}
              aria-disabled={!uiConnected}
              />

              {/* Slash command palette overlay */}
              {showSlashPalette && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24 bg-black/50">
                  <div className="w-full max-w-xl">
                    <SlashCommandPalette
                      overlay
                      searchQuery={input}
                      onSelectAgent={(agentId) => {
                        const agent = agents.find(a => a.id === agentId)
                        if (!agent) return
                        // Add a quick narration message
                        upsertMessage({
                          msgId: `thinking_${Date.now()}`,
                          role: 'thinking',
                          content: `Executing agent: ${agent.name}`,
                          ts: Date.now()
                        })
                        // Send predefined plan execution request
                        const contextTabs = getContextTabs()
                        const tabIds = contextTabs.length > 0 ? contextTabs.map(tab => tab.id) : undefined
                        setProcessing(true)
                        sendMessage(MessageType.EXECUTE_QUERY, {
                          query: agent.goal,
                          tabIds,
                          source: 'sidepanel',
                          metadata: {
                            source: 'sidepanel',
                            executionMode: 'predefined',
                            predefinedPlan: {
                              agentId: agent.id,
                              steps: agent.steps,
                              goal: agent.goal,
                              name: agent.name
                            }
                          }
                        })
                        // Reset input and close palette
                        setInput('')
                        setShowSlashPalette(false)
                        textareaRef.current?.focus()
                      }}
                      onClose={() => {
                        setShowSlashPalette(false)
                        if (input === '/') setInput('')
                        textareaRef.current?.focus()
                      }}
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={!uiConnected || isProcessing || !input.trim()}
                size="sm"
                className="absolute right-3 bottom-3 h-8 w-8 p-0 rounded-full bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/90 text-white shadow-lg flex items-center justify-center"
                variant={'default'}
                aria-label={'Send message'}
              >
                <img src="assets/arrow_upward_alt.svg" alt="" aria-hidden="true" className="w-6 h-6 block pointer-events-none select-none" />
              </Button>
            </div>
          </div>
        </form>
        
        <div 
          id="input-hint" 
          className="mt-1 sm:mt-2 text-center text-xs text-muted-foreground font-medium flex items-center justify-center gap-2 px-2"
          role="status"
          aria-live="polite"
        >
          {/*getLoadingIndicator()*/}
          <span>{getHintText()}</span>
        </div>
      </div>
    </div>
  )
}
