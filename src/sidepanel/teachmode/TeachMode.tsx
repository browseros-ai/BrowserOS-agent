import React, { useEffect } from 'react'
import { TeachModeHome } from './TeachModeHome'
import { TeachModeRecording } from './TeachModeRecording'
import { TeachModeProcessing } from './TeachModeProcessing'
import { TeachModeDetail } from './TeachModeDetail'
import { TeachModeExecution } from './TeachModeExecution'
import { TeachModeSummary } from './TeachModeSummary'
import { useTeachModeStore } from './teachmode.store'

export function TeachMode() {
  const { mode, initializePortMessaging } = useTeachModeStore()

  // Initialize port messaging on mount
  useEffect(() => {
    initializePortMessaging()
  }, [initializePortMessaging])

  // Listen for Chrome runtime messages
  useEffect(() => {
    const handleMessage = (message: any, sender: any, sendResponse: (response: any) => void) => {
      if (message.action === 'TEACH_MODE_EVENT_CAPTURED') {
        // Handle captured events from content script
        const store = useTeachModeStore.getState()
        store.addEvent(message.event)
        sendResponse({ success: true })
      } else if (message.action === 'TEACH_MODE_EXECUTION_UPDATE') {
        // Handle execution progress updates
        const store = useTeachModeStore.getState()
        store.setExecutionProgress(message.progress)
        sendResponse({ success: true })
      }
      return true
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  // Render the appropriate screen based on current mode
  switch (mode) {
    case 'idle':
      return <TeachModeHome />

    case 'recording':
      return <TeachModeRecording />

    case 'processing':
      return <TeachModeProcessing />

    case 'ready':
      return <TeachModeDetail />

    case 'executing':
      return <TeachModeExecution />

    case 'summary':
      return <TeachModeSummary />

    default:
      return <TeachModeHome />
  }
}