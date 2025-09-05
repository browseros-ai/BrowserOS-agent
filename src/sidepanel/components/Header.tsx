import React, { memo, useState } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { useAnalytics } from '../hooks/useAnalytics'
import { SettingsModal } from './SettingsModal'
import { HelpSection } from './HelpSection'
// import { ExperimentModal } from './ExperimentModal'  // Removed - old evals system deprecated
import { HelpCircle, Settings, Pause, RotateCcw, ChevronDown, Plus, Trash2, Star } from 'lucide-react'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'
import { useEffect } from 'react'
import { z } from 'zod'
import { BrowserOSProvidersConfig, BrowserOSProvidersConfigSchema } from '@/lib/llm/settings/types'
import { MCP_SERVERS, type MCPServerConfig } from '@/config/mcpServers'

const GITHUB_REPO_URL: string = 'https://github.com/browseros-ai/BrowserOS'

// Feature flag to enable/disable MCP connector dropdown
const MCP_FEATURE_ENABLED = true

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
  const [showMCPDropdown, setShowMCPDropdown] = useState(false)
  const [providersConfig, setProvidersConfig] = useState<BrowserOSProvidersConfig | null>(null)
  const [providersError, setProvidersError] = useState<string | null>(null)
  const [mcpInstallStatus, setMcpInstallStatus] = useState<{ message: string; type: 'error' | 'success' } | null>(null)
  const [installedServers, setInstalledServers] = useState<any[]>([])
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

  const handleStarClick = () => {
    trackClick('github_star')
    window.open(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer')
  }

  const handleMCPInstall = (serverId: string) => {
    trackClick(`mcp_install_${serverId}`)
    setShowMCPDropdown(false)
    sendMessage(MessageType.MCP_INSTALL_SERVER, { serverId })
  }

  const handleMCPDelete = (instanceId: string, serverName: string) => {
    trackClick(`mcp_delete_${serverName}`)
    if (confirm(`Are you sure you want to remove ${serverName}?`)) {
      sendMessage(MessageType.MCP_DELETE_SERVER, { instanceId })
    }
  }

  const fetchInstalledServers = () => {
    sendMessage(MessageType.MCP_GET_INSTALLED_SERVERS, {})
  }

  // Close dropdown when clicking outside and fetch servers when opening
  useEffect(() => {
    if (!showMCPDropdown) return
    
    // Fetch installed servers when dropdown opens
    fetchInstalledServers()
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.mcp-dropdown-container')) {
        setShowMCPDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMCPDropdown])

  // Load providers config for default provider dropdown
  useEffect(() => {
    const handler = (payload: any) => {
      if (payload && payload.status === 'success' && payload.data) {
        // Handle providers config
        if (payload.data.providersConfig) {
          try {
            const cfg = BrowserOSProvidersConfigSchema.parse(payload.data.providersConfig)
            setProvidersConfig(cfg)
          } catch (err) {
            setProvidersError(err instanceof Error ? err.message : String(err))
          }
        }
        // Handle installed servers response
        if (payload.data.servers) {
          setInstalledServers(payload.data.servers)
        }
      }
    }
    addMessageListener<any>(MessageType.WORKFLOW_STATUS, handler)
    // Initial fetch
    sendMessage(MessageType.GET_LLM_PROVIDERS as any, {})
    return () => removeMessageListener<any>(MessageType.WORKFLOW_STATUS, handler)
  }, [])

  // Listen for MCP server installation/deletion status
  useEffect(() => {
    const handler = (payload: any) => {
      if (payload.status === 'success') {
        // Get server name from config for display
        const serverName = MCP_SERVERS.find(s => s.id === payload.serverId)?.name || payload.serverId
        setMcpInstallStatus({
          message: `${serverName} connected successfully!`,
          type: 'success'
        })
        // Refresh installed servers list after successful installation
        fetchInstalledServers()
      } else if (payload.status === 'deleted') {
        setMcpInstallStatus({
          message: 'Server removed successfully',
          type: 'success'
        })
        // Refresh installed servers list after successful deletion
        fetchInstalledServers()
      } else if (payload.status === 'auth_failed') {
        setMcpInstallStatus({
          message: payload.error || 'Authentication failed. Please try again.',
          type: 'error'
        })
      } else if (payload.status === 'error') {
        setMcpInstallStatus({
          message: payload.error || 'Operation failed. Please try again.',
          type: 'error'
        })
      }
      
      // Clear message after 5 seconds
      setTimeout(() => setMcpInstallStatus(null), 5000)
    }
    
    addMessageListener<any>(MessageType.MCP_SERVER_STATUS, handler)
    return () => removeMessageListener<any>(MessageType.MCP_SERVER_STATUS, handler)
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
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground opacity-80" />
            </div>
          )}
        </div>
        


        <nav className="flex items-center gap-2 sm:gap-3" role="navigation" aria-label="Chat controls">
          {/* GitHub Star button - First position */}
          <Button
            onClick={handleStarClick}
            variant="ghost"
            size="sm"
            className="h-9 px-2 sm:px-3 rounded-xl hover:bg-yellow-100 dark:hover:bg-yellow-900/20 hover:text-yellow-600 dark:hover:text-yellow-400 transition-all duration-300 flex items-center gap-1.5 group"
            aria-label="Star on GitHub"
            title="Star us on GitHub"
          >
            <Star className="w-4 h-4 group-hover:fill-current" />
            <span className="hidden sm:inline text-xs font-medium">Star</span>
          </Button>

          {/* MCP Integrations dropdown - Second position */}
          {MCP_FEATURE_ENABLED && (
            <div className="relative mcp-dropdown-container">
              <Button
                onClick={() => setShowMCPDropdown(!showMCPDropdown)}
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 h-9 px-2 rounded-xl hover:bg-brand/10 hover:text-brand transition-all duration-300"
                aria-label="Connect integrations"
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs">MCPs</span>
              </Button>
              
              {showMCPDropdown && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg bg-background border border-border z-50">
                  <div className="py-1">
                    {MCP_SERVERS.map((server) => {
                      // Check if this server is installed
                      const installedServer = installedServers.find(s => s.name === server.name)
                      const isConnected = installedServer?.authenticated === true
                      
                      return (
                        <div
                          key={server.id}
                          className="flex items-center justify-between w-full px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <img 
                              src={chrome.runtime.getURL(server.iconPath)} 
                              alt=""
                              className="w-4 h-4"
                            />
                            <span>{server.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {installedServer ? (
                              <>
                                {isConnected ? (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                    Connected
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleMCPInstall(server.id)
                                    }}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                                  >
                                    Connect
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleMCPDelete(installedServer.id, server.name)
                                  }}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                                  title={`Remove ${server.name}`}
                                >
                                  <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleMCPInstall(server.id)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Connect
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings button - Third position */}
          <Button
            onClick={handleSettingsClick}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-xl hover:bg-brand/10 hover:text-brand transition-all duration-300"
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4" />
          </Button>

          {/* Experiment Modal - renders its own button */}
          {/* <ExperimentModal
            trackClick={trackClick}
            sendMessage={sendMessage}
            addMessageListener={addMessageListener}
            removeMessageListener={removeMessageListener}
            isProcessing={isProcessing}
          /> */}  {/* Commented out - old evals system deprecated */}

          {isProcessing && (
            <Button
              onClick={handleCancel}
              variant="ghost"
              size="sm"
              className="text-xs hover:bg-brand/5 hover:text-brand transition-all duration-300 flex items-center gap-1"
              aria-label="Pause current task"
            >
              <Pause className="w-4 h-4" />
              Pause
            </Button>
          )}
          
          {showReset && !isProcessing && (
            <Button
              onClick={handleReset}
              variant="ghost"
              size="sm"
              className="text-xs hover:bg-brand/5 hover:text-brand transition-all duration-300 flex items-center gap-1"
              aria-label="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          )}
        </nav>

        {/* Settings Modal */}
        <SettingsModal 
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onOpenHelp={() => {
            setShowSettings(false)
            setShowHelp(true)
          }}
        />
      </header>

      {/* MCP Installation Status Message */}
      {mcpInstallStatus && (
        <div 
          className={`
            fixed top-14 left-1/2 transform -translate-x-1/2 z-50
            px-4 py-2 rounded-lg shadow-lg
            ${mcpInstallStatus.type === 'error' 
              ? 'bg-red-500 text-white' 
              : 'bg-green-500 text-white'}
            animate-in fade-in slide-in-from-top-2 duration-300
          `}
        >
          <p className="text-sm font-medium">{mcpInstallStatus.message}</p>
        </div>
      )}

      {/* Help Section */}
      <HelpSection 
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </>
  )
})