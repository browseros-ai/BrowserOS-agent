import { useEffect, useRef, useCallback } from 'react'
import { z } from 'zod'
import { MessageType } from '@/lib/types/messaging'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore } from '../stores/chatStore'

export function useMessageHandler() {
  const { addMessage, updateMessage, setProcessing, setError, markMessageAsExecuting, markMessageAsCompleting, setExecutingMessageRemoving } = useChatStore()
  const { addMessageListener, removeMessageListener } = useSidePanelPortMessaging()
  
  // Track streaming messages by ID for updates (created lazily on first non-suppressed chunk)
  const streamingMessages = useRef<Map<string, { uiMessageId?: string, content: string, suppressed?: boolean }>>(new Map())
  // Suppress assistant streaming while tools are running
  const suppressStreamingRef = useRef<boolean>(false)
  
  // Zod schema to validate incoming UI message details
  const UIMessageTypeSchema = z.enum([
    'SystemMessage',
    'ThinkingMessage',
    'NewSegment',
    'StreamingChunk',
    'FinalizeSegment',
    'ToolStart',
    'ToolStream',
    'ToolEnd',
    'ToolResult',
    'ErrorMessage',
    'CancelMessage',
    'TaskResult'
  ])

  const UIMessageSchema = z.object({
    messageType: UIMessageTypeSchema,
    messageId: z.string().optional(),
    segmentId: z.number().optional(),
    content: z.string().optional(),
    toolName: z.string().optional(),
    toolArgs: z.object({
      description: z.string().optional(),
      icon: z.string().optional(),
      args: z.record(z.unknown()).optional()
    }).optional(),
    toolResult: z.string().optional(),
    success: z.boolean().optional(),
    error: z.string().optional(),
    data: z.record(z.unknown()).optional()
  })

  // Create stable callback functions
  const handleStreamUpdate = useCallback((payload: any) => {
    const parsed = UIMessageSchema.safeParse(payload?.details)
    if (!parsed.success) return
    const details = parsed.data
    
    // Mark any existing executing messages as completing when new messages are added
    const markExecutingAsCompleting = () => {
      const state = useChatStore.getState()
      const executingMessages = state.messages.filter(msg => msg.metadata?.isExecuting && !msg.metadata?.isCompleting)
      if (executingMessages.length > 0) {
        setExecutingMessageRemoving(true)
        executingMessages.forEach(msg => {
          markMessageAsCompleting(msg.id)
        })
        // Reset the flag after animation
        setTimeout(() => setExecutingMessageRemoving(false), 600)
      }
    }
    
    // Helper: detect and suppress instruction-echo segments
    const shouldSuppressInstructionEcho = (text: string): boolean => {
      const s = (text || '').toLowerCase()
      if (!s) return false
      // Common instruction echoes from system/step prompts
      if (
        s.includes('you are browseragent') ||
        s.includes('todo execution steps') ||
        s.includes('<system-context>') ||
        s.includes('never output <system-context>')
      ) return true

      // Result/step constraints that sometimes get echoed
      if (
        s.includes('ensure your response is a valid tool call') ||
        s.includes('do not use markdown other than for code blocks') ||
        s.includes('do not use bullet points') ||
        s.includes('do not ask clarifying questions') ||
        s.includes('do not provide commentary on your actions') ||
        s.includes('do not hallucinate tool calls') ||
        s.includes('remember to call done_tool') ||
        s.includes('do not use emojis') ||
        s.includes('do not use all caps') ||
        s.startsWith('## ⚠️ critical instructions') ||
        s.startsWith('## \\u26a0\\ufe0f critical instructions')
      ) return true

      // Heuristic: many "do not" lines in a short chunk likely instruction echo
      const doNotCount = (s.match(/\bdo not\b/g) || []).length
      if (doNotCount >= 3 && (s.includes('tool') || s.includes('markdown'))) return true

      return false
    }

    switch (details.messageType) {
      case 'SystemMessage': {
        const category = typeof details.data?.category === 'string' ? details.data?.category as string : undefined
        const content = details.content || ''

        // Task Manager (TODO table) detection and per-prompt handling
        const isTodoTable = content.includes('| # | Status | Task |')
        if (isTodoTable) {
          const currentMessages = useChatStore.getState().messages
          const lastUserIndex = [...currentMessages].map(m => m.role).lastIndexOf('user')
          const lastTodoIndex = [...currentMessages].map(m => m.content.includes('| # | Status | Task |')).lastIndexOf(true)

          if (lastTodoIndex !== -1 && lastTodoIndex > lastUserIndex) {
            // Update the existing Task Manager for the current prompt
            const lastTodoMessage = currentMessages[lastTodoIndex]
            updateMessage(lastTodoMessage.id, content)
          } else {
            // Create a new Task Manager for this prompt
            addMessage({
              role: 'system',
              content,
              metadata: { kind: 'system' as const }
            })
          }
          break
        }

        // Regular system message
        addMessage({
          role: 'system',
          content,
          metadata: { kind: 'system' as const, isStartup: category === 'startup', category }
        })
        break
      }

      case 'ToolStart': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        suppressStreamingRef.current = true
        
        // Add executing message for tool start
        const description = details.toolArgs?.description || details.toolName || 'Executing tool'
        addMessage({
          role: 'system',
          content: description,
          metadata: { kind: 'execution' as const, isExecuting: true, toolName: details.toolName }
        })
        // Mark this message as executing
        {
          const lastMessage = useChatStore.getState().messages.slice(-1)[0]
          if (lastMessage) markMessageAsExecuting(lastMessage.id)
        }
        break
      }

      case 'ToolEnd': {
        // Mark existing executing messages as completing - they will be removed
        markExecutingAsCompleting()
        suppressStreamingRef.current = false
        break
      }

      case 'ThinkingMessage': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Add thinking message
        addMessage({
          role: 'system',
          content: details.content || 'Working…',
          metadata: { kind: 'execution' as const, isExecuting: true }
        })
        // Mark this message as executing
        {
          const lastMessage = useChatStore.getState().messages.slice(-1)[0]
          if (lastMessage) markMessageAsExecuting(lastMessage.id)
        }
        break
      }
      
      case 'NewSegment': {
        // Optionally suppress assistant stream segments during tool execution
        if (suppressStreamingRef.current) {
          break
        }
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Defer creation of the UI message until we see the first chunk
        const messageId = details.messageId || `stream-${Date.now()}`
        streamingMessages.current.set(messageId, { uiMessageId: undefined, content: '', suppressed: false })
        break
      }
      
      case 'StreamingChunk': {
        if (suppressStreamingRef.current) {
          break
        }
        if (details.messageId && details.content) {
          // Initialize tracking for this segment if missing
          if (!streamingMessages.current.has(details.messageId)) {
            streamingMessages.current.set(details.messageId, { uiMessageId: undefined, content: '', suppressed: false })
          }
          const streaming = streamingMessages.current.get(details.messageId)!
          // If not yet created, decide whether to suppress or render
          if (!streaming.uiMessageId) {
            if (shouldSuppressInstructionEcho(details.content)) {
              // Suppress this segment entirely
              streaming.suppressed = true
              streaming.content = ''
              break
            } else {
              // Create assistant stream message lazily on first non-suppressed chunk
              addMessage({
                role: 'assistant',
                content: details.content,
                metadata: { kind: 'stream' as const, streamId: details.messageId }
              })
              const lastMessage = useChatStore.getState().messages.slice(-1)[0]
              if (lastMessage) {
                streaming.uiMessageId = lastMessage.id
                streaming.content = details.content
              }
              break
            }
          }
          // Already created and not suppressed: append content
          if (!streaming.suppressed && streaming.uiMessageId) {
            streaming.content += details.content
            updateMessage(streaming.uiMessageId, streaming.content)
          }
        }
        break
      }
      
      case 'FinalizeSegment': {
        if (suppressStreamingRef.current) {
          // Clean up any tracked entry without rendering
          if (details.messageId) streamingMessages.current.delete(details.messageId)
          break
        }
        if (details.messageId) {
          const streaming = streamingMessages.current.get(details.messageId)
          if (streaming) {
            // If suppressed or never created, just drop it
            if (!streaming.uiMessageId || streaming.suppressed) {
              streamingMessages.current.delete(details.messageId)
              break
            }
            const finalContent = details.content || streaming.content
            if (finalContent) {
              updateMessage(streaming.uiMessageId, finalContent)
            }
            streamingMessages.current.delete(details.messageId)
          }
        }
        break
      }
      
      case 'ToolResult': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Filter out TODO-related messages that shouldn't be shown to the user
        if (details.content && (
          details.content.includes('Completed TODO:') ||
          details.content.includes('Skipped TODO:') ||
          details.content.includes('Went back to TODO:') ||
          details.content.includes('Added') && details.content.includes('TODOs') ||
          details.content.includes('Replaced all TODOs')
        )) {
          // Don't add these messages - they're internal status updates
          break
        }
        
        // Add tool result as assistant message
        if (details.content) {
          addMessage({
            role: 'assistant',
            content: details.content,
            metadata: {
              kind: 'tool-result' as const,
              toolName: details.toolName,
              success: typeof details.success === 'boolean' ? details.success : undefined
            }
          })
        }
        break
      }
      
      case 'ErrorMessage': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Handle error
        const errorMessage = details.error || details.content || 'An error occurred'
        addMessage({
          role: 'system',
          content: errorMessage,
          metadata: { kind: 'error' as const, error: true }
        })
        setError(errorMessage)
        setProcessing(false)
        break
      }
      
      case 'TaskResult': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        suppressStreamingRef.current = false
        
        // Task completed
        setProcessing(false)
        addMessage({
          role: 'system',
          content: details.content || '',
          metadata: { kind: 'task-result' as const, success: typeof details.success === 'boolean' ? details.success : undefined }
        })
        break
      }
      
      case 'CancelMessage': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        suppressStreamingRef.current = false
        
        // Task cancelled
        setProcessing(false)
        addMessage({
          role: 'system',
          content: details.content || 'Task cancelled',
          metadata: { kind: 'cancel' as const }
        })
        break
      }
      
      // Skip other message types for now (ThinkingMessage, DebugMessage, etc.)
      // We can add them later if needed
    }
  }, [addMessage, updateMessage, setProcessing, setError, markMessageAsExecuting, markMessageAsCompleting, setExecutingMessageRemoving])
  
        // Handle workflow status updates
  const handleWorkflowStatus = useCallback((payload: any) => {
    if (payload.status === 'completed' || payload.status === 'failed' || payload.cancelled) {
      setProcessing(false)
      
      // Mark any executing messages as completing
      const state = useChatStore.getState()
      const executingMessages = state.messages.filter(msg => msg.metadata?.isExecuting && !msg.metadata?.isCompleting)
      if (executingMessages.length > 0) {
        setExecutingMessageRemoving(true)
        executingMessages.forEach(msg => {
          markMessageAsCompleting(msg.id)
        })
        // Reset the flag after animation
        setTimeout(() => setExecutingMessageRemoving(false), 600)
      }
      
      if (payload.error && !payload.cancelled) {
        setError(payload.error)
        addMessage({
          role: 'system',
          content: payload.error,
          metadata: { error: true }
        })
      }
    }
  }, [addMessage, setProcessing, setError, markMessageAsCompleting, setExecutingMessageRemoving])
  
  useEffect(() => {
    // Register listeners
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    
    // Cleanup
    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
      streamingMessages.current.clear()
    }
  }, [addMessageListener, removeMessageListener, handleStreamUpdate, handleWorkflowStatus])
  
  // (removed) Port-based PDF parsing handler and listeners — using only runtime onMessage

  // Fallback: also handle runtime onMessage PDF parse requests directly when the side panel is open
  useEffect(() => {
    const handler = (request: any, _sender: chrome.runtime.MessageSender, sendResponse: (resp?: any) => void) => {
      if (!request || request.type !== MessageType.PDF_PARSE_REQUEST) return
      ;(async () => {
        try {
          const { url, maxPages = 40 } = request.payload || {}
          const pdfUrl: string = typeof url === 'string' ? url : ''
          if (!pdfUrl) {
            sendResponse({ ok: false, error: 'MISSING_URL' })
            return
          }
          // Configure pdf.js for text-only URL-based parsing
          try { (GlobalWorkerOptions as any).workerSrc = chrome.runtime.getURL('pdf.worker.mjs') } catch (_e) { /* ignore */ }
          let doc: any
          try {
            doc = await (getDocument as any)({
              url: pdfUrl,
              isEvalSupported: false,
              disableWorker: true,
              disableAutoFetch: false,
              rangeChunkSize: 65536,
              nativeImageDecoderSupport: 'none',
              stopAtErrors: true,
              withCredentials: true,
              httpHeaders: { Accept: 'application/pdf' }
            }).promise
          } catch (err) {
            const em = err instanceof Error ? err.message : String(err)
            if (/Invalid PDF structure/i.test(em)) {
              try {
                await new Promise(r => setTimeout(r, 800))
                const retryDoc = await (getDocument as any)({
                  url: pdfUrl,
                  isEvalSupported: false,
                  disableWorker: true,
                  disableAutoFetch: false,
                  rangeChunkSize: 65536,
                  nativeImageDecoderSupport: 'none',
                  stopAtErrors: true,
                  withCredentials: true,
                  httpHeaders: { Accept: 'application/pdf' }
                }).promise
                doc = retryDoc
              } catch {
                sendResponse({ ok: false, error: 'PARSE_INVALID_STRUCTURE' })
                return
              }
            } else {
              sendResponse({ ok: false, error: em })
              return
            }
          }
          const limit: number = Math.min(doc.numPages || 0, typeof maxPages === 'number' ? maxPages : 40)
          const parts: string[] = []
          for (let i = 1; i <= limit; i++) {
            const page = await doc.getPage(i)
            const content = await page.getTextContent()
            const textItems: string[] = []
            for (const item of content.items) {
              const it: any = item
              if (typeof it.str === 'string') textItems.push(it.str)
            }
            parts.push(`\n\n--- Page ${i} ---\n` + textItems.join(' '))
          }
          sendResponse({ ok: true, text: parts.join('') })
        } catch (e) {
          const em = e instanceof Error ? e.message : String(e)
          sendResponse({ ok: false, error: em })
        }
      })()
      return true
    }
    try { chrome.runtime.onMessage.addListener(handler) } catch (_e) { /* ignore */ }
    return () => { try { chrome.runtime.onMessage.removeListener(handler) } catch (_e) { /* ignore */ } }
  }, [])
}