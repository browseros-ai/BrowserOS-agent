import { AlertCircle, RefreshCw } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'

interface ChatErrorProps {
  error: Error
  onRetry?: () => void
}

function parseErrorMessage(message: string): {
  text: string
  url?: string
  isRateLimit?: boolean
} {
  // Detect BrowserOS rate limit (unique pattern, no provider uses this)
  if (message.includes('BrowserOS LLM daily limit reached')) {
    return {
      text: 'Add your own API key for unlimited usage.',
      url: 'https://dub.sh/browseros-usage-limit',
      isRateLimit: true,
    }
  }

  let text = message
  try {
    const parsed = JSON.parse(message)
    if (parsed?.error?.message) text = parsed.error.message
  } catch {}

  // Extract URL if present
  const urlMatch = text.match(/https?:\/\/[^\s]+/)
  const url = urlMatch?.[0]
  if (url) {
    text = text.replace(url, '').replace(/\s+/g, ' ').trim()
  }

  return { text: text || 'An unexpected error occurred', url }
}

export const ChatError: FC<ChatErrorProps> = ({ error, onRetry }) => {
  const { text, url, isRateLimit } = parseErrorMessage(error.message)

  return (
    <div className="mx-4 flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        <span className="font-medium text-sm">
          {isRateLimit ? 'Daily limit reached' : 'Something went wrong'}
        </span>
      </div>
      <p className="text-center text-destructive text-xs">{text}</p>
      {isRateLimit && (
        <p className="text-muted-foreground text-xs">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Learn more
          </a>
          {' or '}
          <a
            href="/options.html?page=survey"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            take a quick survey
          </a>
        </p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-1 gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      )}
    </div>
  )
}
