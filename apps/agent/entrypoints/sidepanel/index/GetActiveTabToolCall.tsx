import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { type FC, useState } from 'react'
import { cn } from '@/lib/utils'

interface GetActiveTabToolCallProps {
  className?: string
  isLoading?: boolean
}

export const GetActiveTabToolCall: FC<GetActiveTabToolCallProps> = ({
  className,
  isLoading,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)

  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab>()

  useEffect(() => {
    ;(async () => {
      const activeTab = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      setCurrentTab(activeTab?.[0])
    })()
  }, [])

  return (
    <div className={cn('my-2', className)}>
      {/* Collapsible Trigger */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all hover:bg-muted/30',
          isLoading && 'animate-shimmer-tool',
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-[var(--accent-orange)]/10">
            <ExternalLink className="h-2.5 w-2.5 text-[var(--accent-orange)]" />
          </div>
          <span className="font-medium text-muted-foreground text-xs">
            {isLoading ? 'Reading tab content...' : 'Read tab content'}
          </span>
        </div>

        {isLoading && (
          <div className="flex items-center gap-1">
            <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--accent-orange)] [animation-delay:-0.3s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--accent-orange)] [animation-delay:-0.15s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--accent-orange)]" />
          </div>
        )}
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="animate-fadeInUp space-y-2 py-1.5 pr-2 pl-8">
          <div className="flex items-start gap-2 rounded-md p-2 transition-colors hover:bg-muted/20">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-border bg-background">
              <img
                src={currentTab?.favIconUrl ?? '/placeholder.svg'}
                alt=""
                className="h-3.5 w-3.5"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg'
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 line-clamp-2 font-medium text-foreground text-xs">
                {currentTab?.title}
              </div>
              <a
                href={currentTab?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group line-clamp-1 flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-[var(--accent-orange)]"
              >
                <span className="truncate">{currentTab?.url}</span>
                <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
