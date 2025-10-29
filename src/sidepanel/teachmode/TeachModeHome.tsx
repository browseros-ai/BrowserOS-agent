import React, { useEffect, useState } from 'react'
import { Wand2, Play, Trash2 } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { useTeachModeStore } from './teachmode.store'
import { cn } from '@/sidepanel/lib/utils'
import { getFeatureFlags } from '@/lib/utils/featureFlags'
import { BrowserUpgradeNotice } from './BrowserUpgradeNotice'

const UPGRADE_NOTICE_DISMISSED_KEY = 'teachmode_upgrade_notice_dismissed'

export function TeachModeHome() {
  const { recordings, prepareRecording, setActiveRecording, deleteRecording, executeRecording, setMode, loadRecordings, isPortMessagingInitialized } = useTeachModeStore()
  const [showUpgradeNotice, setShowUpgradeNotice] = useState(false)
  const [browserVersion, setBrowserVersion] = useState<string | null>(null)

  // Load recordings only after port messaging is initialized
  useEffect(() => {
    if (isPortMessagingInitialized) {
      loadRecordings()
    }
  }, [isPortMessagingInitialized, loadRecordings])

  // Check feature flag for teach mode
  useEffect(() => {
    const checkTeachModeSupport = async () => {
      const dismissed = localStorage.getItem(UPGRADE_NOTICE_DISMISSED_KEY)
      if (dismissed === 'true') {
        setShowUpgradeNotice(false)
        return
      }

      const featureFlags = getFeatureFlags()
      await featureFlags.initialize()

      const isEnabled = featureFlags.isEnabled('TEACH_MODE')
      const currentVersion = featureFlags.getVersion()

      setBrowserVersion(currentVersion)
      setShowUpgradeNotice(!isEnabled)
    }

    checkTeachModeSupport()
  }, [])

  const handleDismissUpgradeNotice = () => {
    localStorage.setItem(UPGRADE_NOTICE_DISMISSED_KEY, 'true')
    setShowUpgradeNotice(false)
  }

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
    <div className="h-full flex flex-col bg-background-alt overflow-hidden">
      {/* Main centered content - ALWAYS CENTERED */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8 text-center">
        <div className="relative z-0 flex flex-col items-center justify-center min-h-0 max-w-lg w-full">

          {/* Title Section - Always visible */}
          <div className="flex flex-col items-center justify-center -mt-4">
            <h2 className="text-3xl font-bold text-muted-foreground animate-fade-in-up text-center px-2 leading-tight">
              <div className="flex items-center justify-center gap-2">
                <span>Your</span>
                <span className="text-brand">Copycat</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span>assistant</span>
                <img
                  src="/assets/browseros.svg"
                  alt="BrowserOS"
                  className="w-8 h-8 inline-block align-middle animate-fade-in-up"
                />
              </div>
            </h2>
          </div>

          {/* Question */}
          <div className="mb-8 mt-2">
            <h3 className="text-lg font-semibold text-foreground mb-6 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              What would you like to automate?
            </h3>

            {/* Content area - conditionally render workflows or examples */}
            <div className="flex flex-col items-center max-w-lg w-full space-y-3">
              {hasWorkflows ? (
                <>
                  {/* Your Taught Workflows label */}
                  <div className="w-full flex items-center justify-between px-2 mb-2">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <span className="text-base">🎓</span>
                      <span className="bg-gradient-to-r from-brand to-brand/70 bg-clip-text text-transparent">
                        Your Taught Workflows
                      </span>
                    </span>
                    <span className="text-xs bg-brand/20 px-2 py-0.5 rounded-full text-brand font-semibold">
                      {recordings.length}
                    </span>
                  </div>

                  {/* Workflow Cards - styled like example buttons */}
                  {recordings.map((recording) => (
                    <div
                      key={recording.id}
                      className="group relative text-sm h-auto py-3 px-4 whitespace-normal bg-background/50 backdrop-blur-sm border-2 border-brand/30 hover:border-brand hover:bg-brand/5 smooth-hover smooth-transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none overflow-hidden w-full message-enter rounded-lg cursor-pointer"
                      onClick={() => handleRecordingClick(recording)}
                    >
                      {/* Animated background */}
                      <div className="absolute inset-0 bg-gradient-to-r from-brand/0 via-brand/5 to-brand/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

                      {/* Content with actions */}
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="text-left">
                            <div className="font-medium text-foreground group-hover:text-brand transition-colors duration-300">
                              {recording.name}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {recording.steps.length} steps
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleRun(recording.id, e)}
                            className="h-7 w-7 p-0 hover:bg-brand hover:text-white"
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleDelete(recording.id, e)}
                            className="h-7 w-7 p-0 hover:bg-destructive hover:text-white"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Glow effect */}
                      <div className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-brand/20 to-transparent"></div>
                    </div>
                  ))}
                </>
              ) : (
                /* Example Workflows - when empty */
                [
                  { emoji: '📧', text: 'Teach how to unsubscribe from promotional emails' },
                  { emoji: '📊', text: 'Show data to extract from website and fill out a form' },
                  { emoji: '🥳', text: 'Teach any other workflow that comes to your mind!' }
                ].map((example, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant="outline"
                    className="group relative text-sm h-auto min-h-[48px] py-3 px-4 whitespace-normal bg-background/50 backdrop-blur-sm border-2 border-brand/30 hover:border-brand hover:bg-brand/5 smooth-hover smooth-transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none overflow-hidden w-full message-enter"
                    onClick={() => {
                      // Future: This could trigger a pre-built workflow template
                      handleCreateNew()
                    }}
                  >
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-brand/0 via-brand/5 to-brand/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

                    {/* Content */}
                    <span className="relative z-10 font-medium text-foreground group-hover:text-brand transition-colors duration-300">
                      {example.text} <span className="ml-1">{example.emoji}</span>
                    </span>

                    {/* Glow effect */}
                    <div className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-brand/20 to-transparent"></div>
                  </Button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Browser upgrade notice - Above bottom bar when shown */}
      {showUpgradeNotice && (
        <div className="px-6 pb-2 bg-background-alt">
          <BrowserUpgradeNotice
            currentVersion={browserVersion}
            onDismiss={handleDismissUpgradeNotice}
          />
        </div>
      )}

      {/* Bottom bar — match Chat/Agent input shell - ALWAYS PRESENT */}
      <div className="relative bg-[hsl(var(--header))] border-t border-border/50 px-3 py-3 pb-4 flex-shrink-0 overflow-hidden z-20">
        <div className="relative">
          {/* Faux textarea surface with responsive layout */}
          <div
            aria-label="Teach mode quick tips"
            className={cn(
              'text-sm w-full',
              'bg-background/80 backdrop-blur-sm border-2 border-brand/30',
              'hover:border-brand/50 hover:bg-background/90 hover:shadow-md',
              'rounded-2xl shadow-sm px-4 py-3',
              'transition-all duration-300 ease-out',
              'flex flex-col min-[450px]:flex-row min-[450px]:items-end gap-4'
            )}
          >
            {/* Tips content */}
            <div className="flex-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                How teach mode works
              </div>
              <div className="space-y-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground flex-shrink-0">1</span>
                  <span className="text-xs min-[450px]:text-sm">Record your actions step by step</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground flex-shrink-0">2</span>
                  <span className="text-xs min-[450px]:text-sm">Narrate what you're doing as you click, type</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground flex-shrink-0">3</span>
                  <span className="text-xs min-[450px]:text-sm">Run your workflow anytime with one click</span>
                </div>
              </div>
            </div>

            {/* CTA button — responsive position */}
            <div className="flex justify-center min-[450px]:justify-start">
              <Button
                onClick={handleCreateNew}
                size="sm"
                className="h-9 rounded-full px-4 bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/90 text-white shadow-lg flex items-center gap-2 whitespace-nowrap w-full min-[450px]:w-auto"
                aria-label="Teach new workflow"
              >
                <Wand2 className="w-4 h-4" />
                Teach new workflow
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
