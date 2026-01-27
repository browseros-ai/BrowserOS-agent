import { ChevronDown, Folder, Layers } from 'lucide-react'
import type { FC, FormEvent } from 'react'
import { TabSelector } from '@/components/elements/tab-selector'
import { WorkspaceSelector } from '@/components/elements/workspace-selector'
import { SwarmTrigger } from '@/components/swarm/SwarmTrigger'
import { Feature } from '@/lib/browseros/capabilities'
import { useCapabilities } from '@/lib/browseros/useCapabilities'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/use-workspace'
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
  // Swarm props
  swarmEnabled?: boolean
  swarmWorkerCount?: number
  onSwarmToggle?: (enabled: boolean) => void
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
  swarmEnabled = false,
  swarmWorkerCount = 3,
  onSwarmToggle,
}) => {
  const { selectedFolder } = useWorkspace()
  const { supports } = useCapabilities()

  return (
    <footer className="border-border/40 border-t bg-background/80 backdrop-blur-md">
      <ChatAttachedTabs tabs={attachedTabs} onRemoveTab={onRemoveTab} />

      <div className="p-3">
        <div className="flex items-center gap-2">
          <ChatModeToggle mode={mode} onModeChange={onModeChange} />

          {mode === 'agent' && onSwarmToggle && (
            <SwarmTrigger
              enabled={swarmEnabled}
              onToggle={onSwarmToggle}
              workerCount={swarmWorkerCount}
            />
          )}

          <div className="h-4 w-px bg-border/50" />

          <div className="flex items-center gap-1">
            <TabSelector
              selectedTabs={attachedTabs}
              onToggleTab={onToggleTab}
              side="top"
            >
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground data-[state=open]:bg-accent"
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

            {supports(Feature.WORKSPACE_FOLDER_SUPPORT) && (
              <WorkspaceSelector side="top">
                <button
                  type="button"
                  className={cn(
                    'flex cursor-pointer items-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-muted/50 data-[state=open]:bg-accent',
                    selectedFolder
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  title={
                    selectedFolder
                      ? selectedFolder.name
                      : 'Select workspace folder'
                  }
                >
                  <div className="relative">
                    <Folder className="h-4 w-4" />
                    {selectedFolder && (
                      <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--accent-orange)]" />
                    )}
                  </div>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </WorkspaceSelector>
            )}
          </div>
        </div>

        <ChatInput
          input={input}
          status={status}
          mode={mode}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onStop={onStop}
          selectedTabs={attachedTabs}
          onToggleTab={onToggleTab}
        />
      </div>
    </footer>
  )
}
