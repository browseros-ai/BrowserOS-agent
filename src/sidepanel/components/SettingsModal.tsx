import React, { useState, useEffect } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { Slider } from './ui/slider'
import { cn } from '@/sidepanel/lib/utils'
import { z } from 'zod'
import { X, HelpCircle, ExternalLink, Monitor } from 'lucide-react'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks/useSidePanelPortMessaging'
import { MessageType } from '@/lib/types/messaging'

const DISCORD_URL = 'https://discord.com/invite/YKwjt5vuKr'

// Define the props schema with Zod
const SettingsModalPropsSchema = z.object({
  isOpen: z.boolean(),  // Whether the modal is open
  onClose: z.function().args().returns(z.void()),  // Function to close the modal
  onOpenHelp: z.function().args().returns(z.void()).optional()  // Function to open help modal
})

// Infer the type from the schema
type SettingsModalProps = z.infer<typeof SettingsModalPropsSchema>

export function SettingsModal({ isOpen, onClose, onOpenHelp }: SettingsModalProps) {
  const { fontSize, theme, autoScroll, autoCollapseTools, chatMode, setFontSize, setTheme, setAutoScroll, setAutoCollapseTools, setChatMode } = useSettingsStore()
  const [glowEnabled, setGlowEnabled] = useState<boolean>(true)
  const [agentVersion, setAgentVersion] = useState<string>('1.0.0')
  const { sendMessage } = useSidePanelPortMessaging()

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
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Settings content */}
        <div className="space-y-6">

          {/* Theme selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Theme</h3>
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

          {/* Auto-collapse tool results */}
          <div className="flex items-center justify-between px-4 py-2 rounded-xl border border-border/50 bg-card">
            <p className="text-xs text-muted-foreground">Auto-collapse tool results</p>
            <Button
              onClick={() => setAutoCollapseTools(!autoCollapseTools)}
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs ${autoCollapseTools ? 'text-foreground' : 'text-muted-foreground'}`}
              aria-label={`${autoCollapseTools ? 'Disable' : 'Enable'} auto-collapse for tool results`}
            >
              {autoCollapseTools ? 'On' : 'Off'}
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

          {/* Help section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Help & Support</h3>
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Need help getting started?</p>
                  <p className="text-xs text-muted-foreground mt-1">View examples, tips, and documentation</p>
                </div>
                <Button
                  onClick={onOpenHelp}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 rounded-lg"
                  aria-label="Open help guide"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">Open Guide</span>
                </Button>
              </div>
            </div>
          </div>

          {/* About section */}
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