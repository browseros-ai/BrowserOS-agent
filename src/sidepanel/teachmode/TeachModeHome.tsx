import React, { useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { EmptyState } from './components/EmptyState'
import { RecordingCard } from './components/RecordingCard'
import { useTeachModeStore } from './teachmode.store'

export function TeachModeHome() {
  const { recordings, prepareRecording, setActiveRecording, deleteRecording, executeRecording, setMode, loadRecordings } = useTeachModeStore()

  // Load recordings when component mounts
  useEffect(() => {
    loadRecordings()
  }, [loadRecordings])

  const handleCreateNew = () => {
    prepareRecording()
  }

  const handleRecordingClick = (recording: typeof recordings[0]) => {
    setActiveRecording(recording)
    setMode('ready')
  }

  const handleRun = async (recordingId: string) => {
    const recording = recordings.find(r => r.id === recordingId)
    if (recording) {
      setActiveRecording(recording)
      await executeRecording(recordingId)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {recordings.length === 0 ? (
          <EmptyState onCreateNew={handleCreateNew} />
        ) : (
          <div className="flex w-full flex-col gap-4">
            <section className="space-y-3">
              <Button
                onClick={handleCreateNew}
                variant="ghost"
                className="w-full justify-between rounded-lg border border-border/70 bg-card/80 px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-card"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Plus className="h-4 w-4" />
                  Create New Workflow
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase">R</kbd>
                </span>
              </Button>

              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">Your Workflows</span>
                <span className="text-xs font-medium text-muted-foreground">{recordings.length}</span>
              </div>
            </section>

            <div className="flex flex-col gap-3">
              {recordings.map((recording) => (
                <RecordingCard
                  key={recording.id}
                  recording={recording}
                  onClick={() => handleRecordingClick(recording)}
                  onDelete={deleteRecording}
                  onRun={handleRun}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
