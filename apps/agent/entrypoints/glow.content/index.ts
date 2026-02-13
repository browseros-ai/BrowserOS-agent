import type { GlowMessage } from './GlowMessage'

const GLOW_OVERLAY_ID = 'browseros-glow-overlay'
const GLOW_STYLES_ID = 'browseros-glow-styles'
const STOP_BUTTON_ID = 'browseros-stop-button'

const GLOW_THICKNESS = 1.0
const GLOW_OPACITY = 0.6

function injectStyles(): void {
  if (document.getElementById(GLOW_STYLES_ID)) {
    return
  }

  const t = GLOW_THICKNESS

  const style = document.createElement('style')
  style.id = GLOW_STYLES_ID
  style.textContent = `
    @keyframes browseros-glow-pulse {
      0% {
        box-shadow:
          inset 0 0 ${58 * t}px ${26 * t}px transparent,
          inset 0 0 ${50 * t}px ${22 * t}px rgba(251, 102, 24, 0.06),
          inset 0 0 ${42 * t}px ${18 * t}px rgba(251, 102, 24, 0.12),
          inset 0 0 ${34 * t}px ${14 * t}px rgba(251, 102, 24, 0.18);
      }
      50% {
        box-shadow:
          inset 0 0 ${72 * t}px ${35 * t}px transparent,
          inset 0 0 ${64 * t}px ${32 * t}px rgba(251, 102, 24, 0.10),
          inset 0 0 ${54 * t}px ${26 * t}px rgba(251, 102, 24, 0.18),
          inset 0 0 ${46 * t}px ${22 * t}px rgba(251, 102, 24, 0.24);
      }
      100% {
        box-shadow:
          inset 0 0 ${58 * t}px ${26 * t}px transparent,
          inset 0 0 ${50 * t}px ${22 * t}px rgba(251, 102, 24, 0.06),
          inset 0 0 ${42 * t}px ${18 * t}px rgba(251, 102, 24, 0.12),
          inset 0 0 ${34 * t}px ${14 * t}px rgba(251, 102, 24, 0.18);
      }
    }

    @keyframes browseros-glow-fade-in {
      from { opacity: 0; }
      to { opacity: ${GLOW_OPACITY}; }
    }

    @keyframes browseros-stop-fade-in {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    #${GLOW_OVERLAY_ID} {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      opacity: 0;
      will-change: opacity;
      animation:
        browseros-glow-pulse 3s ease-in-out infinite,
        browseros-glow-fade-in 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
    }

    #${STOP_BUTTON_ID} {
      position: fixed !important;
      bottom: 32px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 8px 16px !important;
      border: none !important;
      border-radius: 20px !important;
      background: rgba(0, 0, 0, 0.75) !important;
      color: #fff !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      letter-spacing: 0.01em !important;
      cursor: pointer !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
      opacity: 0;
      animation: browseros-stop-fade-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 200ms forwards !important;
      transition: background 150ms ease !important;
    }

    #${STOP_BUTTON_ID}:hover {
      background: rgba(0, 0, 0, 0.9) !important;
    }

    #${STOP_BUTTON_ID}:active {
      transform: translateX(-50%) scale(0.97) !important;
    }

    #${STOP_BUTTON_ID} svg {
      flex-shrink: 0 !important;
    }
  `
  const appendStyle = () => document.head.appendChild(style)

  if (document.head) {
    appendStyle()
  } else {
    document.addEventListener('DOMContentLoaded', appendStyle, { once: true })
  }
}

function createStopButton(conversationId: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.id = STOP_BUTTON_ID
  // Inline SVG stop icon (rounded square)
  button.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="3"/></svg><span>Stop</span>'

  button.onclick = () => {
    chrome.runtime
      .sendMessage({
        type: 'BROWSEROS_STOP_AGENT',
        conversationId,
      })
      .catch(() => {})
  }
  return button
}

function startGlow(conversationId: string): void {
  stopGlow()
  injectStyles()

  // Glow overlay
  const overlay = document.createElement('div')
  overlay.id = GLOW_OVERLAY_ID

  // Stop button
  const stopButton = createStopButton(conversationId)

  const appendElements = () => {
    document.body.appendChild(overlay)
    document.body.appendChild(stopButton)
  }

  if (document.body) {
    appendElements()
  } else {
    document.addEventListener('DOMContentLoaded', appendElements, {
      once: true,
    })
  }
}

function stopGlow(): void {
  document.getElementById(GLOW_OVERLAY_ID)?.remove()
  document.getElementById(STOP_BUTTON_ID)?.remove()
}

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_start',
  main() {
    let activeConversationId: string | null = null

    browser.runtime.onMessage.addListener(
      (message: GlowMessage, _sender, sendResponse) => {
        if (
          typeof message !== 'object' ||
          !('conversationId' in message) ||
          !('isActive' in message)
        ) {
          return
        }

        if (message.isActive) {
          activeConversationId = message.conversationId
          startGlow(activeConversationId)
        } else if (message.conversationId === activeConversationId) {
          activeConversationId = null
          stopGlow()
        }

        sendResponse({ success: true })
        return true
      },
    )

    window.addEventListener('beforeunload', stopGlow)

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopGlow()
      }
    })
  },
})
