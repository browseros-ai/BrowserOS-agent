import React from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { EmptyState } from './components/EmptyState'
import { RecordingCard } from './components/RecordingCard'
import { useTeachModeStore } from './teachmode.store'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'

export function TeachModeHome() {
  const { recordings, setMode, setActiveRecording, deleteRecording } = useTeachModeStore()
  const { setAppMode } = useSettingsStore()

  const handleCreateNew = () => {
    setMode('intent')
  }

  const handleRecordingClick = (recording: typeof recordings[0]) => {
    setActiveRecording(recording)
    setMode('ready')
  }

  const handleBack = () => {
    // Go back to agent mode
    setAppMode('agent')
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-header">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Chat
        </button>
        <span className="text-sm font-medium text-foreground">Teach Mode</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {recordings.length === 0 ? (
          <EmptyState onCreateNew={handleCreateNew} />
        ) : (
          <div className="p-4 space-y-3">
            {/* Create New Button */}
            <Button
              onClick={handleCreateNew}
              variant="outline"
              className="w-full justify-start gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Workflow
            </Button>

            {/* Recordings Header */}
            <div className="text-sm font-medium text-foreground mt-4 mb-2">
              Your Workflows ({recordings.length})
            </div>

            {/* Recording Cards */}
            <div className="space-y-3">
              {recordings.map((recording) => (
                <RecordingCard
                  key={recording.id}
                  recording={recording}
                  onClick={() => handleRecordingClick(recording)}
                  onDelete={deleteRecording}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}