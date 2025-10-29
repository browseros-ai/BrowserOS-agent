/**
 * Teach Mode Recorder Content Script
 * Based on Chrome's RecordingClient pattern
 * Captures user interactions and sends them to the service
 */

import type { CapturedEvent, ElementContext, TeachModeMessage, ActionType } from '@/lib/teach-mode/types'

(() => {
  const RECORDER_INITIALIZED_KEY = 'nxtscape-teach-recorder-initialized'
  const HEARTBEAT_CHECK_INTERVAL_MS = 100  // Check for heartbeat every 100ms
  const HEARTBEAT_TIMEOUT_MS = 200  // Auto-stop if no heartbeat for 200ms (2 missed beats)
  const SCROLL_DEBOUNCE_MS = 150  // Debounce scroll events

  // Check if already initialized to prevent duplicate listeners
  if ((window as any)[RECORDER_INITIALIZED_KEY]) {
    console.log('[TeachModeRecorder] Already initialized, skipping re-initialization')
    // DO NOT reinitialize - this prevents duplicate event listeners!
    return
  }
  (window as any)[RECORDER_INITIALIZED_KEY] = true

  class TeachModeRecorder {
    isRecording = false  // Made public for access from message handler
    private eventCounter = 0
    lastHeartbeatTime = Date.now()  // Made public for access from message handler
    private heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null

    // Track initial targets for precise selector computation
    private initialInputTarget: { element: Element; context: ElementContext } | null = null
    private initialPointerTarget: { element: Element; context: ElementContext } | null = null
    private pointerDownTimestamp = 0

    // Scroll tracking
    private scrollTimer: ReturnType<typeof setTimeout> | null = null
    private lastScrollPosition = { x: 0, y: 0 }
    private scrollStartPosition = { x: 0, y: 0 }
    private scrollTarget: { element: Element; context: ElementContext } | null = null
    private isScrolling = false

    constructor() {
      console.log('[TeachModeRecorder] Initialized')

      // Try to get tab ID immediately
      this.getTabId()

      // Send ready message
      this.sendMessage({
        action: 'RECORDER_READY',
        source: 'TeachModeRecorder'
      })
    }

    /**
     * Get and store tab ID
     */
    private getTabId(): void {
      chrome.runtime.sendMessage({ action: 'GET_TAB_ID' }, (response) => {
        if (response?.tabId) {
          (window as any).__tabId = response.tabId
          console.log(`[TeachModeRecorder] Got tab ID: ${response.tabId}`)
        }
      })
    }


    /**
     * Start recording events
     */
    start(): void {
      // Always stop first to clean up any existing listeners
      if (this.isRecording) {
        this.stop()
      }

      console.log('[TeachModeRecorder] Starting recording')
      this.isRecording = true
      this.lastHeartbeatTime = Date.now()

      // Start auto-stop check - if no heartbeat for timeout period, stop recording
      this.heartbeatCheckInterval = setInterval(() => {
        const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatTime
        if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
          console.log(`[TeachModeRecorder] No heartbeat for ${HEARTBEAT_TIMEOUT_MS}ms, auto-stopping`)
          this.stop()
        }
      }, HEARTBEAT_CHECK_INTERVAL_MS)

      // Initialize scroll position
      this.lastScrollPosition = {
        x: window.scrollX,
        y: window.scrollY
      }

      // Add event listeners in capture phase (following Chrome pattern)
      window.addEventListener('keydown', this.handleKeyDown, true)
      window.addEventListener('keyup', this.handleKeyUp, true)
      window.addEventListener('input', this.handleInput, true)
      window.addEventListener('change', this.handleChange, true)

      window.addEventListener('pointerdown', this.handlePointerDown, true)
      window.addEventListener('click', this.handleClick, true)
      window.addEventListener('auxclick', this.handleClick, true)
      window.addEventListener('dblclick', this.handleDoubleClick, true)

      // Scroll events - capture phase for both window and element scrolls
      window.addEventListener('scroll', this.handleScroll, true)
      window.addEventListener('wheel', this.handleWheel, { passive: true, capture: true })

      // window.addEventListener('beforeunload', this.handleBeforeUnload, true)
    }

    /**
     * Stop recording events
     */
    stop(): void {
      if (!this.isRecording) return

      console.log('[TeachModeRecorder] Stopping recording')
      this.isRecording = false

      // Clear heartbeat check
      if (this.heartbeatCheckInterval) {
        clearInterval(this.heartbeatCheckInterval)
        this.heartbeatCheckInterval = null
      }

      // Clear any pending scroll timer
      if (this.scrollTimer) {
        clearTimeout(this.scrollTimer)
        this.scrollTimer = null
      }

      // Reset scroll state
      this.isScrolling = false
      this.scrollTarget = null

      // Remove event listeners
      window.removeEventListener('keydown', this.handleKeyDown, true)
      window.removeEventListener('keyup', this.handleKeyUp, true)
      window.removeEventListener('input', this.handleInput, true)
      window.removeEventListener('change', this.handleChange, true)

      window.removeEventListener('pointerdown', this.handlePointerDown, true)
      window.removeEventListener('click', this.handleClick, true)
      window.removeEventListener('auxclick', this.handleClick, true)
      window.removeEventListener('dblclick', this.handleDoubleClick, true)

      window.removeEventListener('scroll', this.handleScroll, true)
      window.removeEventListener('wheel', this.handleWheel, true)

      window.removeEventListener('beforeunload', this.handleBeforeUnload, true)
    }

    /**
     * Compute element context for an element
     */
    private computeElementContext(element: Element): ElementContext {
      const selectors: ElementContext['selectors'] = {}

      // CSS selector - improved
      try {
        selectors.css = this.getCSSSelector(element)
      } catch (e) {
        console.error('[TeachModeRecorder] Failed to compute CSS selector', e)
      }

      // XPath
      try {
        selectors.xpath = this.getXPath(element)
      } catch (e) {
        console.error('[TeachModeRecorder] Failed to compute XPath', e)
      }

      // ARIA selector
      const ariaLabel = element.getAttribute('aria-label')
      const ariaLabelledBy = element.getAttribute('aria-labelledby')
      const role = element.getAttribute('role')

      if (ariaLabel) {
        selectors.ariaLabel = ariaLabel
      }
      if (role) {
        selectors.css = `[role="${role}"]${selectors.css ? ` ${selectors.css}` : ''}`
      }

      // Text content
      const text = element.textContent?.trim()
      if (text && text.length < 100) {
        selectors.text = text
      }

      // Build element context
      const rect = element.getBoundingClientRect()
      const attributes: Record<string, string> = {}
      for (const attr of element.attributes) {
        attributes[attr.name] = attr.value
      }

      // Data test id (common in modern apps)
      const dataTestId = element.getAttribute('data-testid') || element.getAttribute('data-test-id')
      if (dataTestId) {
        selectors.dataTestId = dataTestId
      }

      const context: ElementContext = {
        selectors,
        element: {
          tagName: element.tagName.toLowerCase(),
          type: element.getAttribute('type') || undefined,
          text: element.textContent?.trim() || undefined,
          value: 'value' in element ? (element as HTMLInputElement).value : undefined,
          placeholder: element.getAttribute('placeholder') || undefined,
          attributes,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          isVisible: rect.width > 0 && rect.height > 0,
          isInteractive: !element.hasAttribute('disabled'),
          isDisabled: element.hasAttribute('disabled')
        }
      }

      return context
    }

    /**
     * Get better CSS selector for element
     */
    private getCSSSelector(element: Element): string {
      // Priority: ID > data-testid > specific class > tag with attributes
      if (element.id) {
        return `#${CSS.escape(element.id)}`
      }

      const dataTestId = element.getAttribute('data-testid') || element.getAttribute('data-test-id')
      if (dataTestId) {
        return `[data-testid="${CSS.escape(dataTestId)}"]`
      }

      // Build selector with classes
      let selector = element.tagName.toLowerCase()

      if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/)
          .filter(cls => cls.length > 0)
          .map(cls => `.${CSS.escape(cls)}`)
          .join('')
        if (classes) {
          selector += classes
        }
      }

      // Add key attributes for better specificity
      const type = element.getAttribute('type')
      const name = element.getAttribute('name')
      if (type) {
        selector += `[type="${CSS.escape(type)}"]`
      }
      if (name) {
        selector += `[name="${CSS.escape(name)}"]`
      }

      return selector
    }

    /**
     * Get XPath for element (simple implementation)
     */
    private getXPath(element: Element): string {
      const parts: string[] = []
      let current: Element | null = element

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 0
        let sibling = current.previousSibling

        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE &&
              (sibling as Element).tagName === current.tagName) {
            index++
          }
          sibling = sibling.previousSibling
        }

        const tagName = current.tagName.toLowerCase()
        const part = index > 0 ? `${tagName}[${index + 1}]` : tagName
        parts.unshift(part)

        current = current.parentElement
      }

      return parts.length > 0 ? `//${parts.join('/')}` : ''
    }

    /**
     * Send event to service
     */
    private sendEvent(eventData: {
      type: ActionType
      target?: ElementContext
      action?: Partial<CapturedEvent['action']>
    }): void {
      if (!this.isRecording) return  // Don't send if not recording

      const tabId = (window as any).__tabId
      const capturedEvent: CapturedEvent = {
        id: `content_event_${this.eventCounter++}`,
        timestamp: Date.now(),
        tabId: tabId,  // Add tab ID as separate field
        action: {
          type: eventData.type,
          ...eventData.action
        },
        target: eventData.target
      }

      console.log(`[TeachModeRecorder] Sending ${eventData.type} event #${this.eventCounter} from tab ${tabId || 'unknown'}`)

      const message: TeachModeMessage = {
        action: 'EVENT_CAPTURED',
        source: 'TeachModeRecorder',
        event: capturedEvent
      }

      this.sendMessage(message)
    }

    /**
     * Send message to service
     */
    private sendMessage(message: TeachModeMessage): void {
      try {
        chrome.runtime.sendMessage(message)
      } catch (error) {
        console.error('[TeachModeRecorder] Failed to send message', error)
      }
    }

    /**
     * Set initial input target for precise selectors
     */
    private setInitialInputTarget(event: Event): void {
      const element = event.composedPath()[0]
      if (!(element instanceof Element)) return

      if (this.initialInputTarget?.element === element) return

      this.initialInputTarget = {
        element,
        context: this.computeElementContext(element)
      }
    }

    /**
     * Set initial pointer target for precise selectors
     */
    private setInitialPointerTarget(event: Event): void {
      const element = event.composedPath()[0]
      if (!(element instanceof Element)) return

      if (this.initialPointerTarget?.element === element) return

      this.initialPointerTarget = {
        element,
        context: this.computeElementContext(element)
      }
    }

    // Event handlers (arrow functions to preserve 'this' context)
    private handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.isTrusted) return

      this.setInitialInputTarget(event)

      // Only record special navigation keys, not regular typing
      const specialKeys = ['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']
      if (specialKeys.includes(event.key)) {
        this.sendEvent({
          type: 'keydown',
          action: {
            key: {
              key: event.key,
              code: event.code,
              altKey: event.altKey,
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              shiftKey: event.shiftKey
            }
          }
        })
      }
    }

    private handleKeyUp = (event: KeyboardEvent): void => {
      if (!event.isTrusted) return

      // Only record keyup for special keys
      const specialKeys = ['Enter', 'Tab', 'Escape']
      if (specialKeys.includes(event.key)) {
        this.sendEvent({
          type: 'keyup',
          action: {
            key: {
              key: event.key,
              code: event.code
            }
          }
        })
      }
    }

    private handleInput = (event: Event): void => {
      // We don't record individual input events anymore
      // The 'change' event will capture the final value
      if (!event.isTrusted) return
      this.setInitialInputTarget(event)
    }

    private handleChange = (event: Event): void => {
      if (!event.isTrusted) return

      this.setInitialInputTarget(event)
      if (!this.initialInputTarget) return

      const { element, context } = this.initialInputTarget

      // Skip checkboxes and radios as they're handled by click
      if (element instanceof HTMLInputElement) {
        if (element.type === 'checkbox' || element.type === 'radio') {
          return
        }
      }

      let value = ''
      if ('value' in element) {
        value = (element as HTMLInputElement).value
      }

      this.sendEvent({
        type: 'change',
        target: context,
        action: {
          value
        }
      })
    }

    private handlePointerDown = (event: MouseEvent): void => {
      if (!event.isTrusted) return

      this.pointerDownTimestamp = event.timeStamp
      this.setInitialPointerTarget(event)
    }

    private handleClick = (event: MouseEvent): void => {
      if (!event.isTrusted) return

      this.setInitialPointerTarget(event)
      if (!this.initialPointerTarget) return

      const { element, context } = this.initialPointerTarget

      // Calculate offset position within the element
      const rect = element.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top

      this.sendEvent({
        type: 'click',
        target: context,
        action: {
          mouse: {
            button: event.button,
            x: event.pageX,
            y: event.pageY,
            offsetX: Math.round(offsetX),
            offsetY: Math.round(offsetY)
          },
          key: (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) ? {
            key: '',
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey
          } : undefined
        }
      })
    }

    private handleDoubleClick = (event: MouseEvent): void => {
      if (!event.isTrusted) return

      this.setInitialPointerTarget(event)
      if (!this.initialPointerTarget) return

      const { element, context } = this.initialPointerTarget

      // Calculate offset position within the element
      const rect = element.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top

      this.sendEvent({
        type: 'dblclick',
        target: context,
        action: {
          mouse: {
            button: event.button,
            x: event.pageX,
            y: event.pageY,
            offsetX: Math.round(offsetX),
            offsetY: Math.round(offsetY)
          }
        }
      })
    }

    private handleBeforeUnload = (event: Event): void => {
      if (!event.isTrusted) return

      this.sendEvent({
        type: 'beforeunload',
        action: {}
      })
    }

    private handleScroll = (event: Event): void => {
      if (!event.isTrusted) return

      // Clear any pending timer
      if (this.scrollTimer) {
        clearTimeout(this.scrollTimer)
      }

      // Get the scrolling target
      const target = event.target

      // Check if it's a document/window scroll or element scroll
      const isDocumentScroll = target === document || target === document.documentElement || target === document.body || target === window

      if (isDocumentScroll) {
        // Window/document scroll - only set start position if not already scrolling
        if (!this.isScrolling) {
          this.scrollStartPosition = {
            x: window.scrollX,
            y: window.scrollY
          }
          this.scrollTarget = null  // No element context for document scroll
          this.isScrolling = true
        }
      } else if (target instanceof Element) {
        // Element scroll
        const element = target

        // Track scroll start position on first scroll or element change
        if (!this.isScrolling || (this.scrollTarget && this.scrollTarget.element !== element)) {
          this.scrollStartPosition = {
            x: element.scrollLeft,
            y: element.scrollTop
          }

          this.scrollTarget = {
            element,
            context: this.computeElementContext(element)
          }
          this.isScrolling = true
        }
      } else {
        // Not a valid scroll target
        return
      }

      console.log(`[TeachModeRecorder] Scroll detected on ${isDocumentScroll ? 'document' : 'element'}`)

      // Throttle scroll events - only record after scrolling stops
      this.scrollTimer = setTimeout(() => {
        this.recordScrollEvent()
        this.isScrolling = false  // Reset scrolling state
      }, SCROLL_DEBOUNCE_MS)
    }

    private handleWheel = (event: WheelEvent): void => {
      // Wheel events can trigger scroll, but we'll capture via scroll event
      // This is just to detect user intent to scroll
      if (!event.isTrusted) return

      // We don't need to record wheel separately since scroll event will fire
      // But we could use this to detect scroll direction intent if needed
    }

    private recordScrollEvent(): void {
      // Get current scroll position
      let currentX = 0
      let currentY = 0
      let deltaX = 0
      let deltaY = 0

      if (!this.scrollTarget) {
        // Window/document scroll
        currentX = window.scrollX
        currentY = window.scrollY
        deltaX = currentX - this.scrollStartPosition.x
        deltaY = currentY - this.scrollStartPosition.y
      } else {
        // Element scroll
        const element = this.scrollTarget.element
        currentX = element.scrollLeft
        currentY = element.scrollTop
        deltaX = currentX - this.scrollStartPosition.x
        deltaY = currentY - this.scrollStartPosition.y
      }

      // Only record if there was actual scrolling
      if (deltaX === 0 && deltaY === 0) {
        console.log('[TeachModeRecorder] No scroll delta detected, skipping event')
        return
      }

      console.log(`[TeachModeRecorder] Recording scroll: dx=${deltaX}, dy=${deltaY}, currentPos=(${currentX}, ${currentY})`)

      // Send scroll event
      this.sendEvent({
        type: 'scroll',
        target: this.scrollTarget?.context,
        action: {
          scroll: {
            x: currentX,
            y: currentY,
            deltaX,
            deltaY
          }
        }
      })

      // Update last position for future reference
      this.lastScrollPosition = { x: currentX, y: currentY }
    }
  }

  // Create or recreate recorder instance
  const recorder = new TeachModeRecorder()

  // Message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const message = request as TeachModeMessage & { targetTabId?: number }

    if (message.source !== 'TeachModeService') {
      return
    }

    // For simplified design: accept all messages from service
    // The service ensures only the active tab gets messages

    switch (message.action) {
      case 'START_RECORDING':
        // Store tab ID for debugging
        if (message.targetTabId) {
          (window as any).__tabId = message.targetTabId
        }
        // Only start if not already recording
        if (!recorder.isRecording) {
          console.log(`[TeachModeRecorder] Starting recording for tab ${message.targetTabId}`)
          recorder.start()
        } else {
          console.log(`[TeachModeRecorder] DUPLICATE START - Already recording on tab ${message.targetTabId}`)
        }
        sendResponse({ success: true })
        break

      case 'STOP_RECORDING':
        console.log(`[TeachModeRecorder] Stopping recording for tab ${message.targetTabId || 'unknown'}`)
        recorder.stop()
        sendResponse({ success: true })
        break

      case 'HEARTBEAT_PING':
        // Update heartbeat time
        recorder.lastHeartbeatTime = Date.now()
        // Respond immediately to heartbeat
        sendResponse({
          success: true,
          alive: true,
          timestamp: Date.now(),
          isRecording: recorder.isRecording
        })
        break

      default:
        return
    }

    return true  // Keep message channel open for async response
  })

  console.log('[TeachModeRecorder] Content script loaded')
})()
