import React from 'react'
import { TeachModeStorageClient } from '@/lib/teach-mode/storage/TeachModeStorageClient'

interface RecordingMetadata {
  id: string
  title: string
  description?: string
  url: string
  tabId: number
  startTime: number
  endTime: number
  eventCount: number
  sizeBytes: number
  createdAt: number
}

interface RecordingsListProps {
  recordings: RecordingMetadata[]
  isLoading: boolean
  onDelete: (recordingId: string) => void
  onExport: (recordingId: string) => void
  onPlay: (recordingId: string) => void
  onRefresh: () => void
}

/**
 * List of saved recordings with management actions
 */
export function RecordingsList({
  recordings,
  isLoading,
  onDelete,
  onExport,
  onPlay,
  onRefresh
}: RecordingsListProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const handleDelete = async (recordingId: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) {
      return
    }

    setDeletingId(recordingId)
    try {
      await onDelete(recordingId)
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Recordings ({recordings.length})
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 hover:bg-muted rounded transition-colors"
          title="Refresh recordings"
        >
          <svg
            className={`w-4 h-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Recordings List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading recordings...</div>
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <svg className="w-12 h-12 text-muted-foreground/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-sm text-muted-foreground">No recordings yet</div>
            <div className="text-xs text-muted-foreground mt-1">
              Start recording to capture your interactions
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                {/* Recording Title and URL */}
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {recording.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {recording.url}
                    </div>
                  </div>
                </div>

                {/* Recording Metadata */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <span>{TeachModeStorageClient.formatDuration(recording.startTime, recording.endTime)}</span>
                  <span>•</span>
                  <span>{recording.eventCount} events</span>
                  <span>•</span>
                  <span>{TeachModeStorageClient.formatFileSize(recording.sizeBytes)}</span>
                </div>

                {/* Recording Date */}
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDate(recording.createdAt)}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => onPlay(recording.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded transition-colors"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Play
                  </button>
                  <button
                    onClick={() => onExport(recording.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </button>
                  <button
                    onClick={() => handleDelete(recording.id)}
                    disabled={deletingId === recording.id}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                  >
                    {deletingId === recording.id ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Deleting
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storage Stats (optional footer) */}
      {recordings.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground">
            Total size: {TeachModeStorageClient.formatFileSize(
              recordings.reduce((sum, r) => sum + r.sizeBytes, 0)
            )}
          </div>
        </div>
      )}
    </div>
  )
}