import React, { useState, useEffect } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { Beaker } from 'lucide-react'
import { MessageType } from '@/lib/types/messaging'
import { isDevelopmentMode, ENABLE_TELEMETRY } from '@/config'

interface ExperimentModalProps {
  trackClick: (action: string) => void
  sendMessage: (type: MessageType, payload: any) => void
  addMessageListener: <T>(type: MessageType, handler: (payload: T) => void) => void
  removeMessageListener: <T>(type: MessageType, handler: (payload: T) => void) => void
  isProcessing: boolean
}

export function ExperimentModal({ 
  trackClick, 
  sendMessage, 
  addMessageListener, 
  removeMessageListener, 
  isProcessing 
}: ExperimentModalProps) {
  const [experimentStatus, setExperimentStatus] = useState<string>('')
  const [isRunningExperiment, setIsRunningExperiment] = useState(false)
  const [showExperimentModal, setShowExperimentModal] = useState(false)
  const [experimentConfig, setExperimentConfig] = useState({
    logsTag: ''
  })
  const [availableTags, setAvailableTags] = useState<Array<{tag: string, count: number}>>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)
  const [tagsError, setTagsError] = useState<string | null>(null)

  const fetchAvailableTags = () => {
    setIsLoadingTags(true)
    setTagsError(null)
    sendMessage(MessageType.FETCH_AVAILABLE_TAGS, {})
  }

  const handleRunExperiment = () => {
    trackClick('run_experiment')
    setShowExperimentModal(true)
    // Fetch tags when modal opens (if not already loaded)
    if (availableTags.length === 0) {
      fetchAvailableTags()
    }
  }
  
  const handleStartExperiment = () => {
    setShowExperimentModal(false)
    setIsRunningExperiment(true)
    setExperimentStatus('Starting experiment...')
    
    // Send message to background with configured values
    sendMessage(MessageType.RUN_EXPERIMENT, {
      logsTag: experimentConfig.logsTag
    })
  }

  // Handle escape key to close experiment modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showExperimentModal) {
        setShowExperimentModal(false)
      }
    }

    if (showExperimentModal) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [showExperimentModal])

  // Listen for available tags response
  useEffect(() => {
    const handler = (payload: any) => {
      setIsLoadingTags(false)
      if (payload.status === 'success') {
        // console.log('Received tags:', payload.tags)
        setAvailableTags(payload.tags || [])
        setTagsError(null)
      } else {
        setTagsError(payload.error || 'Failed to fetch tags')
      }
    }

    addMessageListener(MessageType.AVAILABLE_TAGS_RESPONSE, handler)
    return () => removeMessageListener(MessageType.AVAILABLE_TAGS_RESPONSE, handler)
  }, [addMessageListener, removeMessageListener])

  // Listen for experiment updates
  useEffect(() => {
    const handler = (payload: any) => {
      const { status, message: statusMessage, progress, results, error } = payload
      
      if (status === 'error') {
        setExperimentStatus(`Error: ${error}`)
        setIsRunningExperiment(false)
        setTimeout(() => setExperimentStatus(''), 15000)  // Show error for 15 seconds
      } else if (status === 'completed' && isRunningExperiment) {
        setExperimentStatus('Experiment completed!')
        setIsRunningExperiment(false)
        
        // Log results to console for debugging (only if experiment was running)
        // console.log('Experiment Results:', results)
        
        // If we have a compare URL, open it in a new tab
        if (results?.compareUrl) {
          console.log('Compare experiments at:', results.compareUrl)
        }
        
        // Show summary
        if (results?.results) {
          const successful = results.results.filter((r: any) => r.success).length
          const total = results.results.length
          setExperimentStatus(`Completed: ${successful}/${total} successful`)
        }
        
        setTimeout(() => setExperimentStatus(''), 15000)  // Show success for 15 seconds
      } else if (status === 'running' && progress) {
        setExperimentStatus(`${progress.current}/${progress.total} - ${statusMessage}`)
      } else {
        setExperimentStatus(statusMessage || status)
      }
    }

    addMessageListener(MessageType.EXPERIMENT_UPDATE, handler)
    return () => removeMessageListener(MessageType.EXPERIMENT_UPDATE, handler)
  }, [addMessageListener, removeMessageListener, isRunningExperiment])

  return (
    <>
      {/* Experiment button - Dev mode + telemetry enabled only */}
      {isDevelopmentMode() && ENABLE_TELEMETRY && (
        <Button
          onClick={handleRunExperiment}
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 rounded-xl hover:bg-brand/10 hover:text-brand transition-all duration-300"
          aria-label="Run experiment"
          disabled={isRunningExperiment}
        >
          <Beaker className="w-4 h-4" />
        </Button>
      )}

      {/* Experiment Status Message */}
      {experimentStatus && (
        <div 
          className={`fixed top-12 left-0 right-0 z-40 px-4 py-2 text-sm whitespace-pre-wrap ${
            experimentStatus.includes('Error') 
              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' 
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
          }`}
        >
          {experimentStatus}
        </div>
      )}

      {/* Experiment Configuration Modal */}
      {showExperimentModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Close modal when clicking on backdrop
            if (e.target === e.currentTarget) {
              setShowExperimentModal(false)
            }
          }}
        >
          <div className="bg-background rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Configure Experiment</h2>
              <button
                onClick={() => setShowExperimentModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">
                    Logs Tag (source data)
                  </label>
                  <button 
                    onClick={fetchAvailableTags}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isLoadingTags}
                    type="button"
                  >
                    {isLoadingTags ? '⟳ Loading...' : '⟳ Refresh'}
                  </button>
                </div>
                
                {isLoadingTags ? (
                  <div className="w-full px-3 py-2 rounded-lg border border-border bg-background text-muted-foreground">
                    Loading tags...
                  </div>
                ) : tagsError ? (
                  <div className="text-red-500 text-sm">{tagsError}</div>
                ) : (
                  <select
                    value={experimentConfig.logsTag}
                    onChange={(e) => {
                      const newLogsTag = e.target.value
                      setExperimentConfig({
                        logsTag: newLogsTag
                      })
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="">Select a tag...</option>
                    {availableTags.map((item) => {
                      const { tag, count } = item || {}
                      if (!tag) return null
                      return (
                        <option key={tag} value={tag}>
                          {tag} ({count} {count === 1 ? 'prompt' : 'prompts'})
                        </option>
                      )
                    })}
                  </select>
                )}
                
                {experimentConfig.logsTag && (
                  <>
                    <p className="text-xs text-muted-foreground mt-1">
                      Fetches prompts tagged with: {experimentConfig.logsTag}
                    </p>

                  </>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setShowExperimentModal(false)}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStartExperiment}
                size="sm"
                className="bg-brand hover:bg-brand/90"
                disabled={!experimentConfig.logsTag}
              >
                Start Experiment
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
