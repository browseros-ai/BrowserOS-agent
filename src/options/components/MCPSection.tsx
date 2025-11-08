import React, { useEffect, useState } from 'react'
import { Server, CheckCircle2, ChevronDown, ChevronUp, Copy, Check, ExternalLink } from 'lucide-react'
import { useMCPStore } from '../stores/mcpStore'
import { testMCPServer } from '../services/mcp-test-service'
import { getFeatureFlags } from '@/lib/utils/featureFlags'
import { UpgradeNotice } from './UpgradeNotice'

export function MCPSection() {
  const { settings, testResult, setEnabled, setTestResult, loadSettings } = useMCPStore()
  const [isTestLoading, setIsTestLoading] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [tools, setTools] = useState<Array<{ name: string; description: string }>>([])
  const [isCopied, setIsCopied] = useState(false)
  const [isFeatureEnabled, setIsFeatureEnabled] = useState(false)
  const [browserVersion, setBrowserVersion] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()

    // Check feature flag
    const checkFeatureFlag = async () => {
      const featureFlags = getFeatureFlags()
      await featureFlags.initialize()
      const enabled = featureFlags.isEnabled('MCP_SERVER')
      const version = featureFlags.getVersion()
      setIsFeatureEnabled(enabled)
      setBrowserVersion(version)
    }

    checkFeatureFlag()
  }, [loadSettings])

  const handleToggle = async () => {
    await setEnabled(!settings.enabled)
    // Reset test result when toggling
    if (!settings.enabled) {
      setTestResult({ status: 'idle' })
    }
  }

  const handleCopyUrl = async () => {
    if (!settings.serverUrl) return

    try {
      await navigator.clipboard.writeText(settings.serverUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
    }
  }

  const handleTest = async () => {
    if (!settings.serverUrl) return

    setIsTestLoading(true)
    setTestResult({ status: 'loading', timestamp: new Date().toISOString() })
    setShowTools(false)
    setTools([])

    try {
      const result = await testMCPServer(settings.serverUrl)
      setTestResult(result)

      if (result.status === 'success' && result.tools) {
        setTools(result.tools)
      }
    } catch (error) {
      setTestResult({
        status: 'error',
        error: error instanceof Error ? error.message : 'Test failed',
        timestamp: new Date().toISOString()
      })
    } finally {
      setIsTestLoading(false)
    }
  }

  const getTestButtonContent = () => {
    if (testResult.status === 'loading') {
      return (
        <>
          <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
          <span>Testing...</span>
        </>
      )
    }

    if (testResult.status === 'success') {
      return (
        <>
          <CheckCircle2 className="w-5 h-5 text-green-500" strokeWidth={2} />
          <span>Test</span>
        </>
      )
    }

    return <span>Test</span>
  }

  return (
    <section className="bg-card rounded-lg border border-border shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-4 px-6 py-5 border-b border-border">
        <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
          <Server className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        <div className="flex-1">
          <h2 className="text-foreground text-lg font-semibold mb-1">
            BrowserOS as MCP server
          </h2>
          <p className="text-muted-foreground text-sm">
            Enable BrowserOS as an MCP server so MCP clients like Claude can connect.
          </p>
          <a
            href="https://docs.browseros.com/browseros-mcp/how-to-guide"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand hover:text-brand/80 transition-colors text-sm font-medium underline decoration-brand/30 hover:decoration-brand/60"
          >
            View setup guide
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-6">
        {!isFeatureEnabled ? (
          // Disabled state with upgrade notice
          <div className="relative">
            <div className="opacity-40 pointer-events-none space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-foreground text-sm font-medium">
                  Enable BrowserOS as MCP server
                </label>
                <button
                  className="relative w-11 h-6 rounded-full bg-muted"
                  role="switch"
                  aria-checked={false}
                  disabled
                >
                  <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Server URL Preview */}
              <div>
                <label className="text-foreground text-sm font-medium mb-2 block">
                  Server URL
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-muted-foreground text-sm font-mono">
                   http://127.0.0.1:9233/mcp 
                  </div>
                  <button
                    disabled
                    className="p-2 rounded-lg border border-input bg-background"
                    title="Copy URL"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Test Button Preview */}
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border w-full justify-center bg-muted text-muted-foreground border-muted"
              >
                <span>Test</span>
              </button>
            </div>

            {/* Upgrade Notice Overlay */}
            <div className="mt-4">
              <UpgradeNotice
                featureName="BrowserOS as MCP server"
                currentVersion={browserVersion}
                requiredVersion="137.0.7216.69"
              />
            </div>
          </div>
        ) : (
          // Enabled state with full functionality
          <>
            {/* Enable Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-foreground text-sm font-medium">
                Enable BrowserOS as MCP server
              </label>
              <button
                onClick={handleToggle}
                className={`
                  relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out
                  ${settings.enabled ? 'bg-brand' : 'bg-muted'}
                `}
                role="switch"
                aria-checked={settings.enabled}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md
                    transition-transform duration-200 ease-in-out
                    ${settings.enabled ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>

            {/* Server URL and Test (shown only when enabled) */}
            {settings.enabled && (
              <div className="space-y-4">
                {/* Server URL */}
                <div>
                  <label className="text-foreground text-sm font-medium mb-2 block">
                    Server URL
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-foreground text-sm font-mono">
                      {settings.serverUrl || 'Not configured'}
                    </div>
                    <button
                      onClick={handleCopyUrl}
                      disabled={!settings.serverUrl}
                      className="p-2 rounded-lg border border-input bg-background hover:bg-accent hover:border-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Copy URL"
                    >
                      {isCopied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Test Button */}
                <div>
                  <button
                    onClick={handleTest}
                    disabled={isTestLoading || !settings.serverUrl}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                      transition-all border w-full justify-center
                      ${
                        isTestLoading || !settings.serverUrl
                          ? 'bg-muted text-muted-foreground border-muted cursor-not-allowed'
                          : 'bg-background border-input hover:border-brand hover:bg-brand/5 hover:text-brand'
                      }
                    `}
                  >
                    {getTestButtonContent()}
                  </button>

                  {/* Status Messages */}
                  {testResult.status === 'success' && testResult.toolCount !== undefined && (
                    <div className="mt-2 flex items-center justify-center gap-2 text-green-600 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Connected • {testResult.toolCount} tools available</span>
                    </div>
                  )}

                  {testResult.status === 'error' && testResult.error && (
                    <div className="mt-2 text-center text-red-500 text-sm">
                      {testResult.error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Available Tools Section */}
      {isFeatureEnabled && settings.enabled && testResult.status === 'success' && tools.length > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => setShowTools(!showTools)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
          >
            <span className="text-foreground text-sm font-medium">
              Available Tools ({tools.length})
            </span>
            {showTools ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showTools && (
            <div className="px-6 pb-6 max-h-[500px] overflow-y-auto">
              <div className="space-y-2">
                {tools.map((tool, index) => (
                  <div
                    key={index}
                    className="bg-background border border-border rounded-lg px-4 py-3 hover:border-brand/50 transition-colors"
                  >
                    <div className="font-mono text-sm font-semibold text-foreground mb-1">
                      {tool.name}
                    </div>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      {tool.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
