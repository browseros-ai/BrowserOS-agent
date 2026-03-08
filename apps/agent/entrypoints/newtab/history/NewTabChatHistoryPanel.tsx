import { MessageSquareText, Plus } from 'lucide-react'
import type { FC } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { ChatHistory } from '@/entrypoints/sidepanel/history/ChatHistory'
import { useChatSessionContext } from '@/entrypoints/sidepanel/layout/ChatSessionContext'
import { cn } from '@/lib/utils'

const getNewTabConversationHref = (conversationId: string) =>
  `/home?conversationId=${conversationId}`

interface NewTabChatHistoryPanelProps {
  className?: string
}

export const NewTabChatHistoryPanel: FC<NewTabChatHistoryPanelProps> = ({
  className,
}) => {
  const navigate = useNavigate()
  const { resetConversation } = useChatSessionContext()

  const handleNewConversation = () => {
    resetConversation()
    navigate('/home')
  }

  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/90 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.35)] backdrop-blur-sm',
        className,
      )}
    >
      <div className="border-border/70 border-b bg-gradient-to-b from-background via-card to-card px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-base">Conversations</h2>
            <p className="mt-1 text-muted-foreground text-sm leading-5">
              Pick up where you left off or clear the slate for a new BrowserOS
              run.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={handleNewConversation}
          className="mt-4 w-full justify-between rounded-xl border-border/70 bg-background/70 px-4"
        >
          Start new chat
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 px-2 pb-2">
        <ChatHistory
          variant="page"
          newConversationHref="/home"
          getConversationHref={getNewTabConversationHref}
        />
      </div>
    </section>
  )
}
