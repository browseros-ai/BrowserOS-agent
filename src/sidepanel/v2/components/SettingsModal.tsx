import React, { useState, useEffect } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { Slider } from './ui/slider'
// import { cn } from '@/sidepanel/lib/utils'
import { z } from 'zod'
import { XIcon } from './ui/Icons'
import { useSettingsStore } from '@/sidepanel/v2/stores/settingsStore'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks/useSidePanelPortMessaging'
import { MessageType } from '@/lib/types/messaging'

const DISCORD_URL = 'https://discord.com/invite/YKwjt5vuKr'
const AUTO_COLLAPSE_DEFAULT_SECS = 10  // Default seconds when enabling

// Define the props schema with Zod
const SettingsModalPropsSchema = z.object({
  isOpen: z.boolean(),  // Whether the modal is open
  onClose: z.function().args().returns(z.void())  // Function to close the modal
})

// Infer the type from the schema
type SettingsModalProps = z.infer<typeof SettingsModalPropsSchema>

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { fontSize, theme, autoScroll, autoCollapseDelayMs, showPdfPreview, autoCollapseKeys, setFontSize, setTheme, setAutoScroll, setAutoCollapseDelayMs, setShowPdfPreview, setAutoCollapseKey, setAutoCollapseKeys } = useSettingsStore()
  const [glowEnabled, setGlowEnabled] = useState<boolean>(true)
  const [agentVersion, setAgentVersion] = useState<string>('1.0.0')
  const { sendMessage } = useSidePanelPortMessaging()
  // No separate configurator toggle; shown only when auto-collapse is enabled

  // Select theme
  const selectTheme = (next: 'light' | 'dark' | 'gray') => {
    setTheme(next)
  }

  // Close modal when clicking outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Load persisted glow setting and get version
  useEffect(() => {
    const GLOW_ENABLED_KEY = 'nxtscape-glow-enabled'
    try {
      chrome.storage?.local?.get(GLOW_ENABLED_KEY, (result) => {
        if (result && Object.prototype.hasOwnProperty.call(result, GLOW_ENABLED_KEY)) {
          setGlowEnabled(result[GLOW_ENABLED_KEY] !== false)
        } else {
          setGlowEnabled(true)
        }
      })
    } catch (_e) {
      setGlowEnabled(true)
    }
    
    // Get agent version from manifest
    try {
      const manifest = chrome.runtime.getManifest()
      setAgentVersion(manifest.version || '1.0.0')
    } catch (_e) {
      // Keep default version
    }
  }, [])

  // Toggle glow
  const toggleGlow = () => {
    const GLOW_ENABLED_KEY = 'nxtscape-glow-enabled'
    const next = !glowEnabled
    setGlowEnabled(next)
    try {
      chrome.storage?.local?.set({ [GLOW_ENABLED_KEY]: next })
    } catch (_e) {
      // ignore
    }

    // Apply immediately on current active tab for instant feedback
    try {
      chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs && tabs[0] && tabs[0].id
        if (typeof tabId === 'number') {
          if (next) {
            sendMessage(MessageType.GLOW_START, { tabId })
          } else {
            sendMessage(MessageType.GLOW_STOP, { tabId })
          }
        }
      })
    } catch (_e) {
      // ignore
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 mt-4 mb-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 id="settings-modal-title" className="text-lg font-semibold text-foreground">
            Settings
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-muted"
            aria-label="Close settings"
          >
            <XIcon />
          </Button>
        </div>

        {/* Settings content */}
        <div className="space-y-6">

          {/* Theme selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Preferences</h3>
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Change app theme</p>
                <div className="inline-flex rounded-lg border border-border bg-background overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => selectTheme('light')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      theme === 'light' ? 'bg-brand text-white' : 'text-foreground hover:bg-muted'
                    }`}
                    aria-pressed={theme === 'light'}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => selectTheme('dark')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${
                      theme === 'dark' ? 'bg-brand text-white' : 'text-foreground hover:bg-muted'
                    }`}
                    aria-pressed={theme === 'dark'}
                  >
                    Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => selectTheme('gray')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${
                      theme === 'gray' ? 'bg-brand text-white' : 'text-foreground hover:bg-muted'
                    }`}
                    aria-pressed={theme === 'gray'}
                  >
                    Gray
                  </button>
                </div>
              </div>
            </div>

            {/* Page Glow */}
            <div className="flex items-center justify-between px-4 py-2 rounded-xl border border-border/50 bg-card">
              <p className="text-xs text-muted-foreground">Page glow during actions</p>
              <Button
                onClick={toggleGlow}
                variant="ghost"
                size="sm"
                className={`h-7 px-2 text-xs ${glowEnabled ? 'text-foreground' : 'text-muted-foreground'}`}
                aria-label={`${glowEnabled ? 'Disable' : 'Enable'} page glow`}
              >
                {glowEnabled ? 'On' : 'Off'}
              </Button>
            </div>

          {/* Auto-Scroll */}
          <div className="flex items-center justify-between px-4 py-2 rounded-xl border border-border/50 bg-card">
            <p className="text-xs text-muted-foreground">Auto-scroll chat to bottom</p>
            <Button
              onClick={() => setAutoScroll(!autoScroll)}
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs ${autoScroll ? 'text-foreground' : 'text-muted-foreground'}`}
              aria-label={`${autoScroll ? 'Disable' : 'Enable'} auto-scroll`}
            >
              {autoScroll ? 'On' : 'Off'}
            </Button>
          </div>

          {/* Auto-collapse tool results (seconds) + configurator */}
          <div className="p-0 rounded-xl border border-border/50 bg-card overflow-hidden">
            {/* Slider header: delay + toggle + config button */}
            <div className="flex items-center justify-between px-4 py-2">
              <p className="text-xs text-muted-foreground">Auto-collapse tool results <span className="opacity-70">(seconds)</span></p>
              <div className="flex items-center gap-2">
                <div className={`inline-flex items-center rounded-lg border border-border bg-background overflow-hidden shrink-0 ${((autoCollapseDelayMs || 0) === 0) ? 'opacity-50' : ''}`}>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    step={1}
                    value={Math.max(1, Math.min(30, Math.round((autoCollapseDelayMs || (AUTO_COLLAPSE_DEFAULT_SECS * 1000)) / 1000)))}
                    onChange={(e) => {
                      const secs = Math.max(1, Math.min(30, Math.floor(Number(e.target.value) || 0)))
                      setAutoCollapseDelayMs(secs * 1000)
                    }}
                    disabled={(autoCollapseDelayMs || 0) === 0}
                    className="h-7 w-12 px-2 text-right text-xs bg-transparent outline-none"
                    aria-label="Auto-collapse delay in seconds"
                  />
                </div>
                <Button
                  onClick={() => {
                    const enabled = (autoCollapseDelayMs || 0) > 0
                    if (enabled) {
                      setAutoCollapseDelayMs(0)
                    } else {
                      const currentSecs = Math.max(1, Math.min(30, Math.round((autoCollapseDelayMs || (AUTO_COLLAPSE_DEFAULT_SECS * 1000)) / 1000)))
                      setAutoCollapseDelayMs(currentSecs * 1000)
                    }
                  }}
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 text-xs ${(autoCollapseDelayMs || 0) > 0 ? 'text-foreground' : 'text-muted-foreground'}`}
                  aria-label={`${(autoCollapseDelayMs || 0) > 0 ? 'Disable' : 'Enable'} auto-collapse for tool results`}
                >
                  {(autoCollapseDelayMs || 0) > 0 ? 'On' : 'Off'}
                </Button>
              </div>
            </div>

            {/* Configurator appears only when auto-collapse is enabled */}
            {(autoCollapseDelayMs || 0) > 0 && (
              <div className="px-4 pb-3">
                <div className="text-xs text-muted-foreground mb-2">
                  Select dropdowns that should auto-collapse.
                </div>
                <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pr-1">
                  {[
                    'task_manager_tool', 'todo_manager_tool', 'navigation_tool', 'tab_operations_tool',
                    'find_element_tool', 'interact_tool', 'scroll_tool', 'search_tool',
                    'group_tabs_tool', 'get_selected_tabs_tool', 'extract_tool', 'screenshot_tool',
                    'validator_tool', 'done_tool', 'result_tool'
                  ].map(key => {
                    const checked = autoCollapseKeys.length === 0 ? true : autoCollapseKeys.includes(key)
                    return (
                      <label key={key} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="accent-[hsl(var(--brand))]"
                          checked={checked}
                          onChange={(e) => {
                            const all = ['task_manager_tool','todo_manager_tool','navigation_tool','tab_operations_tool','find_element_tool','interact_tool','scroll_tool','search_tool','group_tabs_tool','get_selected_tabs_tool','extract_tool','screenshot_tool','validator_tool','done_tool','result_tool']
                            if (autoCollapseKeys.length === 0) {
                              const next = e.target.checked ? all : all.filter(k => k !== key)
                              setAutoCollapseKeys(next)
                            } else {
                              // Enforce at least one selected
                              if (!e.target.checked && autoCollapseKeys.length <= 1) {
                                return
                              }
                              setAutoCollapseKey(key, e.target.checked)
                            }
                          }}
                        />
                        <span className="uppercase tracking-wide text-[10px] text-muted-foreground">{key}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="flex items-center justify-end gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAutoCollapseKeys(['task_manager_tool','todo_manager_tool','navigation_tool','tab_operations_tool','find_element_tool','interact_tool','scroll_tool','search_tool','group_tabs_tool','get_selected_tabs_tool','extract_tool','screenshot_tool','validator_tool','done_tool','result_tool'])}
                  >
                    Apply to all
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* PDF preview for extracts */}
          <div className="flex items-center justify-between px-4 py-2 rounded-xl border border-border/50 bg-card">
            <p className="text-xs text-muted-foreground">Show PDF preview</p>
            <Button
              onClick={() => setShowPdfPreview(!showPdfPreview)}
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs ${showPdfPreview ? 'text-foreground' : 'text-muted-foreground'}`}
              aria-label={`${showPdfPreview ? 'Disable' : 'Enable'} PDF preview`}
            >
              {showPdfPreview ? 'On' : 'Off'}
            </Button>
          </div>
          </div>

          

          {/* Font Size */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Typography</h3>
            <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Font Size</p>
                  <p className="text-xs text-muted-foreground">Adjust the text size across the app</p>
                </div>
                <div className="text-sm font-mono text-muted-foreground min-w-[3rem] text-right">
                  {fontSize}px
                </div>
              </div>
              <Slider
                value={fontSize}
                min={13}
                max={21}
                step={1}
                onChange={setFontSize}
                aria-label="Font size"
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Small</span>
                <span>Large</span>
              </div>
            </div>
          </div>

          {/* More settings can be added here */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">About</h3>
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <p className="text-sm text-muted-foreground">
                BrowserOS Agentic Assistant v{agentVersion}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm text-foreground">Have feedback or ideas? We'd love to hear from you.</p>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open Discord to leave feedback"
                >
                  <Button size="sm" variant="outline" className="rounded-lg">
                    Join Discord
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-6 pt-4 border-t border-border/50">
        </div>
      </div>
    </div>
  )
} 