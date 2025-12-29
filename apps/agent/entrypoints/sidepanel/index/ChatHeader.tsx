import { Github, Plus, SettingsIcon } from 'lucide-react'
import type { FC } from 'react'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import { productRepositoryUrl } from '@/lib/constants/productUrls'
import { BrowserOSIcon, ProviderIcon } from '@/lib/llm-providers/providerIcons'
import type { ProviderType } from '@/lib/llm-providers/types'
import { ChatProviderSelector } from './ChatProviderSelector'
import type { Provider } from './chatTypes'

interface ChatHeaderProps {
  selectedProvider: Provider
  providers: Provider[]
  onSelectProvider: (provider: Provider) => void
  onNewConversation: () => void
  hasMessages: boolean
}

export const ChatHeader: FC<ChatHeaderProps> = ({
  selectedProvider,
  providers,
  onSelectProvider,
  onNewConversation,
  hasMessages,
}) => {
  return (
    <header className="flex items-center justify-between border-border/40 border-b bg-background/80 px-3 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        {/* Provider Selector */}
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
            onClick={onNewConversation}
            className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            title="New conversation"
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
