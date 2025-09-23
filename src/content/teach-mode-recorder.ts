/**
 * Teach Mode Recorder Content Script
 * Based on Chrome's RecordingClient pattern
 * Captures user interactions and sends them to the service
 */

import type { CapturedEvent, Selectors, TeachModeMessage } from '@/lib/teach-mode/types'

(() => {
  const RECORDER_INITIALIZED_KEY = 'nxtscape-teach-recorder-initialized'

  // Check if already initialized to prevent duplicate listeners
  if ((window as any)[RECORDER_INITIALIZED_KEY]) {
    console.log('[TeachModeRecorder] Already initialized')
    return
  }
  (window as any)[RECORDER_INITIALIZED_KEY] = true

  class TeachModeRecorder {
    private isRecording = false
    private eventCounter = 0

    // Track initial targets for precise selector computation
    private initialInputTarget: { element: Element; selectors: Selectors } = {
      element: document.documentElement,
      selectors: {}
    }
    private initialPointerTarget: { element: Element; selectors: Selectors } = {
      element: document.documentElement,
      selectors: {}
    }
    private pointerDownTimestamp = 0

    constructor() {
      console.log('[TeachModeRecorder] Initialized')

      // Send ready message
      this.sendMessage({
        action: 'RECORDER_READY',
        source: 'TeachModeRecorder'
      })
    }

    /**
     * Start recording events
     */
    start(): void {
      if (this.isRecording) return

      console.log('[TeachModeRecorder] Starting recording')
      this.isRecording = true

      // Add event listeners in capture phase (following Chrome pattern)
      window.addEventListener('keydown', this.handleKeyDown, true)
      window.addEventListener('keyup', this.handleKeyUp, true)
      window.addEventListener('input', this.handleInput, true)
      window.addEventListener('change', this.handleChange, true)

      window.addEventListener('pointerdown', this.handlePointerDown, true)
      window.addEventListener('click', this.handleClick, true)
      window.addEventListener('auxclick', this.handleClick, true)
      window.addEventListener('dblclick', this.handleDoubleClick, true)

      window.addEventListener('beforeunload', this.handleBeforeUnload, true)
    }

    /**
     * Stop recording events
     */
    stop(): void {
      if (!this.isRecording) return

      console.log('[TeachModeRecorder] Stopping recording')
      this.isRecording = false

      // Remove event listeners
      window.removeEventListener('keydown', this.handleKeyDown, true)
      window.removeEventListener('keyup', this.handleKeyUp, true)
      window.removeEventListener('input', this.handleInput, true)
      window.removeEventListener('change', this.handleChange, true)

      window.removeEventListener('pointerdown', this.handlePointerDown, true)
      window.removeEventListener('click', this.handleClick, true)
      window.removeEventListener('auxclick', this.handleClick, true)
      window.removeEventListener('dblclick', this.handleDoubleClick, true)

      window.removeEventListener('beforeunload', this.handleBeforeUnload, true)
    }

    /**
     * Compute selectors for an element
     */
    private computeSelectors(element: Element): Selectors {
      const selectors: Selectors = {}

      // CSS selector - simple for Phase 1
      try {
        if (element.id) {
          selectors.css = `#${element.id}`
        } else if (element.className) {
          selectors.css = `.${element.className.split(' ').join('.')}`
        } else {
          selectors.css = element.tagName.toLowerCase()
        }
      } catch (e) {
        console.error('[TeachModeRecorder] Failed to compute CSS selector', e)
      }

      // XPath - simple for Phase 1
      try {
        selectors.xpath = this.getXPath(element)
      } catch (e) {
        console.error('[TeachModeRecorder] Failed to compute XPath', e)
      }

      // Text content
      const text = element.textContent?.trim()
      if (text && text.length < 100) {
        selectors.text = text
      }

      // Tag name
      selectors.tagName = element.tagName.toLowerCase()

      return selectors
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
    private sendEvent(event: Partial<CapturedEvent>): void {
      if (!this.isRecording) return

      const message: TeachModeMessage = {
        action: 'EVENT_CAPTURED',
        source: 'TeachModeRecorder',
        event: {
          id: `content_event_${this.eventCounter++}`,
          timestamp: Date.now(),
          type: 'click',  // Will be overridden
          ...event
        } as CapturedEvent
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

      if (this.initialInputTarget.element === element) return

      this.initialInputTarget = {
        element,
        selectors: this.computeSelectors(element)
      }
    }

    /**
     * Set initial pointer target for precise selectors
     */
    private setInitialPointerTarget(event: Event): void {
      const element = event.composedPath()[0]
      if (!(element instanceof Element)) return

      if (this.initialPointerTarget.element === element) return

      this.initialPointerTarget = {
        element,
        selectors: this.computeSelectors(element)
      }
    }

    // Event handlers (arrow functions to preserve 'this' context)
    private handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.isTrusted) return

      this.setInitialInputTarget(event)

      this.sendEvent({
        type: 'keydown',
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey
      })
    }

    private handleKeyUp = (event: KeyboardEvent): void => {
      if (!event.isTrusted) return

      this.sendEvent({
        type: 'keyup',
        key: event.key
      })
    }

    private handleInput = (event: Event): void => {
      if (!event.isTrusted) return

      this.setInitialInputTarget(event)
      const { element, selectors } = this.initialInputTarget

      // Get value from element
      let value = ''
      if ('value' in element) {
        value = (element as HTMLInputElement).value
      } else if (element.textContent) {
        value = element.textContent
      }

      this.sendEvent({
        type: 'input',
        selectors,
        value
      })
    }

    private handleChange = (event: Event): void => {
      if (!event.isTrusted) return

      this.setInitialInputTarget(event)
      const { element, selectors } = this.initialInputTarget

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
        selectors,
        value
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
      const { selectors } = this.initialPointerTarget

      this.sendEvent({
        type: 'click',
        selectors,
        button: event.button,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey
      })
    }

    private handleDoubleClick = (event: MouseEvent): void => {
      if (!event.isTrusted) return

      this.setInitialPointerTarget(event)
      const { selectors } = this.initialPointerTarget

      this.sendEvent({
        type: 'dblclick',
        selectors,
        button: event.button
      })
    }

    private handleBeforeUnload = (event: Event): void => {
      if (!event.isTrusted) return

      this.sendEvent({
        type: 'beforeunload'
      })
    }
  }

  // Create recorder instance
  const recorder = new TeachModeRecorder()

  // Message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const message = request as TeachModeMessage

    if (message.source !== 'TeachModeService') {
      return
    }

    switch (message.action) {
      case 'START_RECORDING':
        recorder.start()
        sendResponse({ success: true })
        break

      case 'STOP_RECORDING':
        recorder.stop()
        sendResponse({ success: true })
        break

      default:
        return
    }

    return true  // Keep message channel open for async response
  })

  console.log('[TeachModeRecorder] Content script loaded')
})()