import React, { useEffect } from 'react'
import { Wand2, Play, Trash2 } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { useTeachModeStore } from './teachmode.store'
import { cn } from '@/sidepanel/lib/utils'

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

  const handleRun = async (recordingId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const recording = recordings.find(r => r.id === recordingId)
    if (recording) {
      setActiveRecording(recording)
      await executeRecording(recordingId)
    }
  }

  const handleDelete = (recordingId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteRecording(recordingId)
  }

  const hasWorkflows = recordings.length > 0

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header Section - Always Visible */}
      <div className={cn(
        "flex flex-col items-center px-6 pt-8 pb-6 border-b border-border/50 bg-background/95 backdrop-blur-sm",
        hasWorkflows ? "pt-6 pb-5" : "pt-12 pb-8"
      )}>
        {/* BrowserOS Branding */}
        <div className={cn(
          "flex items-center justify-center",
          hasWorkflows ? "mb-3" : "mb-6"
        )}>
          <h2 className={cn(
            "font-bold text-muted-foreground flex items-center gap-2 text-center",
            hasWorkflows ? "text-2xl" : "text-3xl"
          )}>
            <span>Teach</span>
            <span className="text-brand">BrowserOS</span>
            <img
              src="/assets/browseros.svg"
              alt="BrowserOS"
              className={cn(
                "inline-block ml-1",
                hasWorkflows ? "w-6 h-6" : "w-8 h-8"
              )}
            />
          </h2>
        </div>

        {/* Subtitle */}
        <p className={cn(
          "text-muted-foreground",
          hasWorkflows ? "text-base mb-4" : "text-lg mb-8"
        )}>
          Show it once, automate forever
        </p>

        {/* Create Button */}
        <Button
          onClick={handleCreateNew}
          size={hasWorkflows ? "default" : "lg"}
          variant="outline"
          className="gap-2 border-[hsl(var(--brand))] text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))] hover:text-white transition-colors"
        >
          <Wand2 className={hasWorkflows ? "w-4 h-4" : "w-5 h-5"} />
          Create New Workflow
        </Button>
      </div>

      {/* Workflows Section - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {hasWorkflows ? (
          <div className="space-y-4 pb-4">
            {/* Workflows Header */}
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-medium text-foreground">
                Your Workflows
              </h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {recordings.length}
              </span>
            </div>

            {/* Simplified Workflow Cards */}
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  onClick={() => handleRecordingClick(recording)}
                  className={cn(
                    "group relative flex items-center gap-3 p-4 rounded-lg border border-border/50",
                    "bg-card/50 hover:bg-card hover:border-border hover:shadow-sm",
                    "transition-all duration-200 cursor-pointer"
                  )}
                >
                  {/* Icon */}
                  <div className="text-2xl flex-shrink-0">
                    {recording.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {recording.name}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{recording.steps.length} steps</span>
                      {recording.runCount > 0 && (
                        <>
                          <span>•</span>
                          <span>Run {recording.runCount} times</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleRun(recording.id, e)}
                      className="h-8 w-8 p-0 border-[hsl(var(--brand))] text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))] hover:text-white transition-colors"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleDelete(recording.id, e)}
                      className="h-8 w-8 p-0 border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Empty state with instructions */
          <div className="max-w-md mx-auto space-y-8">
            {/* How it works section */}
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                How it works
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Start recording</p>
                    <p className="text-xs text-muted-foreground">Click record and perform your task - BrowserOS learns by watching</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Narrate what you're doing</p>
                    <p className="text-xs text-muted-foreground">Speak as you click - this helps BrowserOS understand your intent</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Run it anytime</p>
                    <p className="text-xs text-muted-foreground">Your workflow is saved and ready to repeat</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Example Workflows */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-4">
                Popular workflows
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: "📧", text: "Unsubscribe from emails" },
                  { icon: "📊", text: "Extract data" },
                  { icon: "🔍", text: "Monitor changes" },
                  { icon: "🛍️", text: "Find best deals" }
                ].map((example, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm text-muted-foreground py-2 px-3 rounded-md bg-muted/50 border border-border/40"
                  >
                    <span className="text-base">{example.icon}</span>
                    <span className="text-xs">{example.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
