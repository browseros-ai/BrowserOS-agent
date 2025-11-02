import { useEffect, useCallback, useState, useRef } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore, type PubSubMessage } from '../stores/chatStore'
import { useTeachModeStore } from '../teachmode/teachmode.store'
import { PdfRequestHandler } from '@/lib/services/PdfRequestHandler'
import { PdfProcessingService } from '@/lib/services/PdfProcessingService'
import { PdfService } from '@/lib/services/PdfService'
import { PdfExtractionService } from '@/lib/services/PdfExtractionService'
import { Logging } from '@/lib/utils/Logging'

interface HumanInputRequest {
  requestId: string
  prompt: string
}

// Cache PDF handler to avoid reinitialization
let pdfHandler: PdfRequestHandler | null = null;

/**
 * Get cached PDF request handler instance
 * Uses singleton pattern to avoid reinitializing PDF services on every request
 *
 * WHY HERE: The PDF handler is in useMessageHandler because:
 * - PDF tool sends PDF_PARSE_REQUEST messages from content script to sidepanel
 * - useMessageHandler is the central message router that receives these requests
 * - PDF.js requires sidepanel execution (worker threads, memory management, security)
 * - Chrome extension architecture requires this cross-process communication pattern
 *
 *
 * Services initialized once and reused:
 * - PdfService:           Core PDF.js operations and worker management
 * - PdfExtractionService: Text extraction, search, and outline processing
 * - PdfProcessingService: Orchestrates the entire PDF processing workflow
 * - PdfRequestHandler:    Message handling and caching coordination
 */
function getPdfHandler(): PdfRequestHandler {
  if (!pdfHandler) {
    // Initialize PDF processing pipeline with all required services
    pdfHandler = new PdfRequestHandler(
      new PdfProcessingService(
        new PdfService(),          // Handles PDF.js document loading and metadata
        new PdfExtractionService() // Handles text extraction, search, and outlines
      )
    );
  }
  return pdfHandler;
}

export function useMessageHandler() {
  const { upsertMessage, setProcessing, reset } = useChatStore()
  const { addMessageListener, removeMessageListener, sendMessage } = useSidePanelPortMessaging()
  const [humanInputRequest, setHumanInputRequest] = useState<HumanInputRequest | null>(null)
  const handleBackendEvent = useTeachModeStore(state => state.handleBackendEvent)
  
  const clearHumanInputRequest = useCallback(() => {
    setHumanInputRequest(null)
  }, [])

  const handleStreamUpdate = useCallback((payload: any) => {
    // Handle new architecture events (with executionId and event structure)
    if (payload?.event) {
      const event = payload.event
      
      // Handle message events
      if (event.type === 'message') {
        const message = event.payload as PubSubMessage
        upsertMessage(message)
      }
      
      // Handle human-input-request events
      if (event.type === 'human-input-request') {
        const request = event.payload
        setHumanInputRequest({
          requestId: request.requestId,
          prompt: request.prompt
        })
      }

      // Handle teach-mode-event
      if (event.type === 'teach-mode-event') {
        handleBackendEvent(event.payload)
      }
    }
    // Legacy handler for old event structure (for backward compatibility during transition)
    else if (payload?.action === 'PUBSUB_EVENT') {
      // Handle message events
      if (payload.details?.type === 'message') {
        const message = payload.details.payload as PubSubMessage
        upsertMessage(message)
      }
      
      // Handle human-input-request events
      if (payload.details?.type === 'human-input-request') {
        const request = payload.details.payload
        setHumanInputRequest({
          requestId: request.requestId,
          prompt: request.prompt
        })
      }

      // Handle teach-mode-event (legacy)
      if (payload.details?.type === 'teach-mode-event') {
        handleBackendEvent(payload.details.payload)
      }
    }
  }, [upsertMessage, handleBackendEvent])
  
  // Handle workflow status for processing state
  const handleWorkflowStatus = useCallback((payload: any) => {
    // With singleton execution, we handle all workflow status messages
    if (payload?.status === 'success' || payload?.status === 'error') {
      // Execution completed (success or error)
      setProcessing(false)
    }
    // Note: We still let ChatInput set processing(true) when sending query
    // This avoids race conditions and provides immediate UI feedback
  }, [setProcessing])
  
  // Set up runtime message listener for execution starting notification
  useEffect(() => {
    const handleRuntimeMessage = (message: any) => {
      // Handle execution starting from newtab
      if (message?.type === MessageType.EXECUTION_STARTING) {
        console.log(`[SidePanel] Execution starting from ${message.source}`)
        setProcessing(true)
      }

      // Handle panel close signal
      if (message?.type === MessageType.CLOSE_PANEL) {
        window.close()
      }

      // Handle PDF parsing requests
      if (message?.type === MessageType.PDF_PARSE_REQUEST) {
        console.log('[SIDEPANEL] Received PDF_PARSE_REQUEST:', message.requestId, 'format:', message.payload?.format);
        const handler = getPdfHandler(); // Use cached instance
        handler.handleRequest(message);
        // Note: Response is sent via broadcast, not callback
      }

      // Handle PDF cache clearing
      if (message?.type === MessageType.PDF_CLEAR_CACHE) {
        Logging.log('SidePanel', `Received PDF_CLEAR_CACHE for execution: ${message.payload?.executionId}`);
        const handler = getPdfHandler();
        if (message.payload?.executionId) {
          handler.clearCache(message.payload.executionId);
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleRuntimeMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
    }
  }, [setProcessing])

  // Set up port message listeners
  useEffect(() => {
    // Register listeners
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)

    // Cleanup
    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    }
  }, [addMessageListener, removeMessageListener, handleStreamUpdate, handleWorkflowStatus])
  
  return {
    humanInputRequest,
    clearHumanInputRequest
  }
}
