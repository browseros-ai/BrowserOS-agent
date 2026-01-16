import { MessageSquareHeart, X } from 'lucide-react'
import type { FC } from 'react'
import { Message, MessageContent } from '@/components/ai-elements/message'
import { Button } from '@/components/ui/button'

interface JtbdPopupProps {
  onTakeSurvey: () => void
  onDismiss: () => void
}

export const JtbdPopup: FC<JtbdPopupProps> = ({ onTakeSurvey, onDismiss }) => {
  return (
    <Message from="assistant">
      <MessageContent>
        <div className="relative rounded-lg border border-border/50 bg-card p-4 shadow-sm">
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-2 right-2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-6">
            <MessageSquareHeart className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-sm">Help us improve BrowserOS!</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Take a quick 3-minute survey.
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={onTakeSurvey}>
              Take Survey
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Maybe Later
            </Button>
          </div>
        </div>
      </MessageContent>
    </Message>
  )
}
