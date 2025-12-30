import { ChevronDown, Layers } from 'lucide-react'
import type { FC, FormEvent } from 'react'
import { TabSelector } from '@/components/elements/tab-selector'
import { ChatAttachedTabs } from './ChatAttachedTabs'
import { ChatInput } from './ChatInput'
import { ChatModeToggle } from './ChatModeToggle'
import type { ChatMode } from './chatTypes'

interface ChatFooterProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  input: string
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  status: 'streaming' | 'submitted' | 'ready' | 'error'
  onStop: () => void
  attachedTabs: chrome.tabs.Tab[]
  onToggleTab: (tab: chrome.tabs.Tab) => void
  onRemoveTab: (tabId?: number) => void
}

export const ChatFooter: FC<ChatFooterProps> = ({
  mode,
  onModeChange,
  input,
  onInputChange,
  onSubmit,
  status,
  onStop,
  attachedTabs,
  onToggleTab,
  onRemoveTab,
}) => {
  return (
    <footer className="border-border/40 border-t bg-background/80 backdrop-blur-md">
      {mode === 'chat' && (
        <ChatAttachedTabs tabs={attachedTabs} onRemoveTab={onRemoveTab} />
      )}

      <div className="p-3">
        <div className="flex items-center gap-2">
          <ChatModeToggle mode={mode} onModeChange={onModeChange} />

          {mode === 'chat' && (
            <TabSelector
              selectedTabs={attachedTabs}
              onToggleTab={onToggleTab}
              side="top"
            >
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1.5 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground data-[state=open]:bg-accent"
                title="Select tabs"
              >
                <Layers className="h-4 w-4" />
                {attachedTabs.length > 0 && (
                  <span className="font-medium text-[var(--accent-orange)] text-xs">
                    {attachedTabs.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3" />
              </button>
            </TabSelector>
          )}
        </div>

        <ChatInput
          input={input}
          status={status}
          mode={mode}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onStop={onStop}
        />
      </div>
    </footer>
  )
}
