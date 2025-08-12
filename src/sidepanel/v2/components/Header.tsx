import React, { memo, useState } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { useAnalytics } from '../hooks/useAnalytics'
import { SettingsModal } from './SettingsModal'
import { HelpSection } from './HelpSection'
import { HelpIcon, SettingsIcon, PauseIcon, ResetIcon, ChevronDownIcon } from './ui/Icons'
import { useSettingsStore } from '@/sidepanel/v2/stores/settingsStore'
import { useEffect } from 'react'
import { z } from 'zod'
import { BrowserOSProvidersConfig, BrowserOSProvidersConfigSchema } from '@/lib/llm/settings/types'

const GITHUB_REPO_URL: string = 'https://github.com/browseros-ai/BrowserOS'

interface HeaderProps {
  onReset: () => void
  showReset: boolean
  isProcessing: boolean
}

/**
 * Header component for the sidepanel
 * Displays title, connection status, and action buttons (pause/reset)
 * Memoized to prevent unnecessary re-renders
 */
export const Header = memo(function Header({ onReset, showReset, isProcessing }: HeaderProps) {
  const { sendMessage, connected, addMessageListener, removeMessageListener } = useSidePanelPortMessaging()
  const { trackClick } = useAnalytics()
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [providersConfig, setProvidersConfig] = useState<BrowserOSProvidersConfig | null>(null)
  const [providersError, setProvidersError] = useState<string | null>(null)
  const { theme } = useSettingsStore()
  
  
  const handleCancel = () => {
    trackClick('pause_task')
    sendMessage(MessageType.CANCEL_TASK, {
      reason: 'User clicked pause button',
      source: 'sidepanel'
    })
  }
  
  const handleReset = () => {
    trackClick('reset_conversation')
    // Send reset message to background
    sendMessage(MessageType.RESET_CONVERSATION, {
      source: 'sidepanel'
    })
    
    // Clear local state
    onReset()
  }

  const handleSettingsClick = () => {
    trackClick('open_settings')
    setShowSettings(true)
  }

  const handleHelpClick = () => {
    trackClick('open_help')
    setShowHelp(true)
  }

  // Load providers config for default provider dropdown
  useEffect(() => {
    const handler = (payload: any) => {
      if (payload && payload.status === 'success' && payload.data && payload.data.providersConfig) {
        try {
          const cfg = BrowserOSProvidersConfigSchema.parse(payload.data.providersConfig)
          setProvidersConfig(cfg)
        } catch (err) {
          setProvidersError(err instanceof Error ? err.message : String(err))
        }
      }
    }
    addMessageListener<any>(MessageType.WORKFLOW_STATUS, handler)
    // Initial fetch
    sendMessage(MessageType.GET_LLM_PROVIDERS as any, {})
    return () => removeMessageListener<any>(MessageType.WORKFLOW_STATUS, handler)
  }, [])

  return (
    <>
      <header 
        className="relative flex items-center justify-between h-12 px-3 bg-[hsl(var(--header))] border-b border-border/50"
        role="banner"
      >

        <div className="flex items-center ">
          {providersConfig && (
            <div className="relative mt-0.5">
              <select
                className={`h-9 w-26 pl-2 pr-8 rounded-lg border ${theme === 'gray' ? 'border-white/40' : 'border-border'} bg-[hsl(var(--header))] text-foreground text-xs font-light appearance-none`}
                value={providersConfig.defaultProviderId}
                onChange={(e) => {
                  const nextId = e.target.value
                  const nextProviders = providersConfig.providers.map(p => ({ ...p, isDefault: p.id === nextId }))
                  const nextConfig: BrowserOSProvidersConfig = {
                    defaultProviderId: nextId,
                    providers: nextProviders
                  }
                  try {
                    BrowserOSProvidersConfigSchema.parse(nextConfig)
                    setProvidersConfig(nextConfig)
                    const ok = sendMessage<BrowserOSProvidersConfig>(MessageType.SAVE_LLM_PROVIDERS as any, nextConfig)
                    if (!ok) setProvidersError('Failed to send save message')
                  } catch (err) {
                    setProvidersError(err instanceof Error ? err.message : String(err))
                  }
                }}
                aria-label="Select default provider"
                title="Select default provider"
              >
                {providersConfig.providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground opacity-80" />
            </div>
          )}
        </div>
        


        <nav className="flex items-center gap-3" role="navigation" aria-label="Chat controls">
          {/* Help button */}
          <Button
            onClick={handleHelpClick}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-xl hover:bg-brand/10 hover:text-brand transition-all duration-300"
            aria-label="Open help"
          >
            <HelpIcon />
          </Button>

          {/* Settings button */}
          <Button
            onClick={handleSettingsClick}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-xl hover:bg-brand/10 hover:text-brand transition-all duration-300"
            aria-label="Open settings"
          >
            <SettingsIcon />
          </Button>

          {isProcessing && (
            <Button
              onClick={handleCancel}
              variant="ghost"
              size="sm"
              className="text-xs hover:bg-brand/5 hover:text-brand transition-all duration-300"
              aria-label="Pause current task"
            >
              <PauseIcon />
              Pause
            </Button>
          )}
          
          {showReset && !isProcessing && (
            <Button
              onClick={handleReset}
              variant="ghost"
              size="sm"
              className="text-xs hover:bg-brand/5 hover:text-brand transition-all duration-300"
              aria-label="Reset conversation"
            >
              <ResetIcon />
              Reset
            </Button>
          )}
        </nav>

        {/* Settings Modal */}
        <SettingsModal 
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </header>

      {/* Help Section */}
      <HelpSection 
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </>
  )
})