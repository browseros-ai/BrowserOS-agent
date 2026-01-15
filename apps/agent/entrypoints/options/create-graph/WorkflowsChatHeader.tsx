import { Github, Plus, SettingsIcon } from 'lucide-react'
import type { FC } from 'react'
import { ChatProviderSelector } from '@/components/chat/ChatProviderSelector'
import type { Provider } from '@/components/chat/chatComponentTypes'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import { productRepositoryUrl } from '@/lib/constants/productUrls'
import { BrowserOSIcon, ProviderIcon } from '@/lib/llm-providers/providerIcons'
import type { ProviderType } from '@/lib/llm-providers/types'

interface WorkflowsChatHeaderProps {
  selectedProvider: Provider
  providers: Provider[]
  onSelectProvider: (provider: Provider) => void
  onNewWorkflow: () => void
  hasMessages: boolean
}

export const WorkflowsChatHeader: FC<WorkflowsChatHeaderProps> = ({
  selectedProvider,
  providers,
  onSelectProvider,
  onNewWorkflow,
  hasMessages,
}) => {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-border/40 border-b bg-background/80 px-3 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <ChatProviderSelector
          providers={providers}
          selectedProvider={selectedProvider}
          onSelectProvider={onSelectProvider}
        >
          <button
            type="button"
            className="group relative inline-flex cursor-pointer items-center gap-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground data-[state=open]:bg-accent"
            title="Change AI Provider"
          >
            {selectedProvider.type === 'browseros' ? (
              <BrowserOSIcon size={18} />
            ) : (
              <ProviderIcon
                type={selectedProvider.type as ProviderType}
                size={18}
              />
            )}
            <span className="font-semibold text-base">
              {selectedProvider.name}
            </span>
          </button>
        </ChatProviderSelector>
      </div>

      <div className="flex items-center gap-1">
        {hasMessages && (
          <button
            type="button"
            onClick={onNewWorkflow}
            className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            title="New workflow"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}

        <a
          href={productRepositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          title="Star on Github"
        >
          <Github className="h-4 w-4" />
        </a>

        <a
          href="/options.html"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          title="Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </a>

        <ThemeToggle
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          iconClassName="h-4 w-4"
        />
      </div>
    </header>
  )
}
