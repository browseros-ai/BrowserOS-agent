import React from 'react'
import { AlertCircle, X, ExternalLink } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'

interface BrowserUpgradeNoticeProps {
  currentVersion: string | null
  onDismiss?: () => void
  className?: string
}

export function BrowserUpgradeNotice({ currentVersion, onDismiss, className }: BrowserUpgradeNoticeProps) {
  const handleUpgradeClick = () => {
    chrome.tabs.create({ url: 'https://github.com/browseros-ai/BrowserOS/releases/latest' })
  }

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-lg border border-l-4 border-orange-200 border-l-orange-500 bg-white p-4 shadow-sm dark:border-orange-800 dark:border-l-orange-600 dark:bg-card",
        className
      )}
    >
      {/* Icon */}
      <AlertCircle className="h-5 w-5 flex-shrink-0 text-orange-500 dark:text-orange-400" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          BrowserOS Update Required
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          You're using BrowserOS {currentVersion || 'an older version'}. Please upgrade to use Teach mode.
        </p>
      </div>

      {/* Action Button */}
      <button
        onClick={handleUpgradeClick}
        className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-md border border-orange-500 bg-transparent px-3 py-1.5 text-xs font-medium text-orange-500 transition-colors hover:bg-orange-500 hover:text-white dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-400 dark:hover:text-white"
      >
        Update BrowserOS
        <ExternalLink className="h-3 w-3" />
      </button>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
