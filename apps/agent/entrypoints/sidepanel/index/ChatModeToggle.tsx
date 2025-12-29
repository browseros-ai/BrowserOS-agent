import { MessageSquare, Zap } from 'lucide-react'
import type { FC } from 'react'
import { cn } from '@/lib/utils'
import type { ChatMode } from './chatTypes'

interface ChatModeToggleProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
}

export const ChatModeToggle: FC<ChatModeToggleProps> = ({
  mode,
  onModeChange,
}) => {
  return (
    <div className="flex items-center rounded-full border border-border/50 bg-muted p-0.5">
      <button
        type="button"
        onClick={() => onModeChange('chat')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-medium text-xs transition-all',
          mode === 'chat'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground',
        )}
        title="Chat Mode"
      >
        <MessageSquare className="h-3 w-3" />
        <span>Chat</span>
      </button>
      <button
        type="button"
        onClick={() => onModeChange('agent')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-medium text-xs transition-all',
          mode === 'agent'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground',
        )}
        title="Agent Mode"
      >
        <Zap className="h-3 w-3" />
        <span>Agent</span>
      </button>
    </div>
  )
}
