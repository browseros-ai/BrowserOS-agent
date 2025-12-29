import { Check, Copy, ExternalLink, Server } from 'lucide-react'
import { type FC, useState } from 'react'
import { Button } from '@/components/ui/button'

interface MCPServerHeaderProps {
  serverUrl: string | null
  isLoading: boolean
  error: string | null
}

const DOCS_URL = 'https://docs.browseros.com/browseros-mcp/how-to-guide'

export const MCPServerHeader: FC<MCPServerHeaderProps> = ({
  serverUrl,
  isLoading,
  error,
}) => {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    if (!serverUrl) return

    try {
      await navigator.clipboard.writeText(serverUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      // Clipboard API failed
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-orange)]/10">
          <Server className="h-6 w-6 text-[var(--accent-orange)]" />
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-xl">BrowserOS MCP Server</h2>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-[var(--accent-orange)]"
            >
              Setup a client
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="mb-6 text-muted-foreground text-sm">
            Connect BrowserOS to MCP clients like claude code, gemini and
            others.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="whitespace-nowrap font-medium text-sm">
              Server URL:
            </span>
            <div className="flex flex-1 items-center gap-2">
              <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm sm:max-w-md">
                {isLoading ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : error ? (
                  <span className="text-destructive">{error}</span>
                ) : (
                  serverUrl
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                disabled={!serverUrl || isLoading}
                className="shrink-0"
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
