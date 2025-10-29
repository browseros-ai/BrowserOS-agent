/**
 * Glow animation content script
 * Provides visual feedback during agent execution
 */

(() => {
  const GLOW_OVERLAY_ID = 'nxtscape-glow-overlay'
  const GLOW_STYLES_ID = 'nxtscape-glow-styles'
  const GLOW_INITIALIZED_KEY = 'nxtscape-glow-initialized'
  const GLOW_ENABLED_KEY = 'nxtscape-glow-enabled'  // Stored in chrome.storage.local

  // Glow thickness controls - adjust these to change glow intensity
  const GLOW_THICKNESS = 1.0  // Multiplier for all glow values (0.5 = thinner, 1.5 = thicker)
  const GLOW_OPACITY = 0.6  // Final opacity of the glow overlay (0.0 - 1.0)
  
  // Check if already initialized to prevent duplicate listeners
  if ((window as any)[GLOW_INITIALIZED_KEY]) {
    console.log('[Nxtscape] Glow animation already initialized')
    return
  }
  (window as any)[GLOW_INITIALIZED_KEY] = true
  
  /**
   * Create and inject glow animation styles
   */
  function injectStyles(): void {
    if (document.getElementById(GLOW_STYLES_ID)) {
      return
    }

    // Calculate glow values based on thickness multiplier
    const t = GLOW_THICKNESS

    const style = document.createElement('style')
    style.id = GLOW_STYLES_ID
    style.textContent = `
      @keyframes nxtscape-glow-pulse {
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

      @keyframes nxtscape-glow-fade-in {
        from { opacity: 0; }
        to { opacity: ${GLOW_OPACITY}; }
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
          nxtscape-glow-pulse 3s ease-in-out infinite,
          nxtscape-glow-fade-in 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
      }
    `
    document.head.appendChild(style)
  }
  
  /**
   * Start glow animation
   */
  function startGlow(): void {
    // Remove existing overlay if present
    stopGlow()
    
    // Inject styles
    injectStyles()
    
    // Create overlay
    const overlay = document.createElement('div')
    overlay.id = GLOW_OVERLAY_ID
    document.body.appendChild(overlay)
    
    console.log('[Nxtscape] Glow animation started')
  }
  
  /**
   * Stop glow animation
   */
  function stopGlow(): void {
    const overlay = document.getElementById(GLOW_OVERLAY_ID)
    if (overlay) {
      overlay.remove()
      console.log('[Nxtscape] Glow animation stopped')
    }
  }

  /**
   * Read whether glow is enabled (default true)
   */
  function isGlowEnabled (): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        chrome.storage?.local?.get(GLOW_ENABLED_KEY, (result) => {
          // If key is missing, treat as enabled by default
          const enabled = result && Object.prototype.hasOwnProperty.call(result, GLOW_ENABLED_KEY)
            ? result[GLOW_ENABLED_KEY] !== false
            : true
          resolve(enabled)
        })
      } catch (_e) {
        // Fail-open to avoid breaking flows
        resolve(true)
      }
    })
  }
  
  /**
   * Message listener
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.source !== 'GlowAnimationService') {
      return
    }
    
    switch (request.action) {
      case 'startGlow': {
        // Gate on persisted setting
        isGlowEnabled().then((enabled) => {
          if (enabled) {
            startGlow()
          }
          sendResponse({ success: true, skipped: !enabled })
        })
        return true
      }
        
      case 'stopGlow':
        stopGlow()
        sendResponse({ success: true })
        break
        
      default:
        sendResponse({ success: false, error: 'Unknown action' })
    }
    
    return true  // Keep message channel open for async response
  })
  
  // Clean up on page unload
  window.addEventListener('beforeunload', stopGlow)
  
  // Also clean up on visibility change (tab switch)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopGlow()
    }
  })
  
  // Start glow immediately if we're being re-injected after navigation
  // The service will send a start message right after injection
})()