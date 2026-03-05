import { ArrowLeft, Plus } from 'lucide-react'
import type { FC } from 'react'
import { ChatProviderSelector } from '@/components/chat/ChatProviderSelector'
import type { Provider } from '@/components/chat/chatComponentTypes'
import { BrowserOSIcon, ProviderIcon } from '@/lib/llm-providers/providerIcons'
import type { ProviderType } from '@/lib/llm-providers/types'

interface NewTabChatHeaderProps {
  selectedProvider: Provider
  providers: Provider[]
  onSelectProvider: (provider: Provider) => void
  onNewConversation: () => void
  onBackToSearch: () => void
  hasMessages: boolean
}

export const NewTabChatHeader: FC<NewTabChatHeaderProps> = ({
  selectedProvider,
  providers,
  onSelectProvider,
  onNewConversation,
  onBackToSearch,
  hasMessages,
}) => {
  return (
    <header className="flex items-center justify-between border-border/40 border-b bg-background/80 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        {/* Back to search */}
        <button
          type="button"
          onClick={onBackToSearch}
          className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          title="Back to search"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Provider selector */}
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
      </div>
    </header>
  )
}
