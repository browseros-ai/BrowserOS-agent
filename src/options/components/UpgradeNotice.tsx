import React from 'react'
import { AlertCircle, ExternalLink } from 'lucide-react'

interface UpgradeNoticeProps {
  featureName: string
  currentVersion: string | null
  requiredVersion: string
  className?: string
}

export function UpgradeNotice({
  featureName,
  currentVersion,
  requiredVersion,
  className = ''
}: UpgradeNoticeProps) {
  const handleUpgradeClick = () => {
    chrome.tabs.create({ url: 'https://github.com/browseros-ai/BrowserOS/releases/latest' })
  }

  return (
    <div className={`flex items-start gap-3 rounded-lg border border-l-4 border-orange-200 border-l-orange-500 bg-orange-50/50 p-4 ${className}`}>
      <AlertCircle className="w-5 h-5 flex-shrink-0 text-orange-500 mt-0.5" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-orange-900">
          BrowserOS Update Required
        </p>
        <p className="mt-1 text-xs text-orange-700">
          {featureName} requires BrowserOS v{requiredVersion} or higher.
          You're currently on {currentVersion || 'an older version'}.
        </p>
      </div>

      <button
        onClick={handleUpgradeClick}
        className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-md border border-orange-500 bg-transparent px-3 py-1.5 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-500 hover:text-white"
      >
        Update BrowserOS
        <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  )
}
