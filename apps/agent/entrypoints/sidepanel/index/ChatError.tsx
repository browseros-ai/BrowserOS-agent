import { AlertCircle, RefreshCw } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'

interface ChatErrorProps {
  error: Error
  onRetry?: () => void
}

function parseErrorMessage(message: string): { text: string; url?: string } {
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
  const { text, url } = parseErrorMessage(error.message)

  return (
    <div className="mx-4 flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        <span className="font-medium text-sm">Something went wrong</span>
      </div>
      <p className="text-center text-destructive text-xs">{text}</p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground text-xs underline hover:text-foreground"
        >
          Learn more
        </a>
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
