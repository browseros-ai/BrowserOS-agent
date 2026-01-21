import { Zap } from 'lucide-react'
import type { FC } from 'react'
import { Switch } from '@/components/ui/switch'
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
  const isAgentMode = mode === 'agent'

  return (
    <label
      htmlFor="agent-mode-toggle"
      className="flex cursor-pointer items-center gap-2"
    >
      <Switch
        id="agent-mode-toggle"
        checked={isAgentMode}
        onCheckedChange={(checked) => onModeChange(checked ? 'agent' : 'chat')}
      />
      <div className="flex items-center gap-1">
        <Zap
          className={cn(
            'h-3.5 w-3.5 transition-colors',
            isAgentMode
              ? 'text-[var(--accent-orange)]'
              : 'text-muted-foreground',
          )}
        />
        <span
          className={cn(
            'font-medium text-xs transition-colors',
            isAgentMode ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          Agent {isAgentMode ? 'ON' : 'OFF'}
        </span>
      </div>
    </label>
  )
}
