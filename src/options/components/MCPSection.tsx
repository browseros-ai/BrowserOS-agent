import React, { useEffect, useState } from 'react'
import { Server, CheckCircle2 } from 'lucide-react'
import { useMCPStore } from '../stores/mcpStore'
import { testMCPServer } from '../services/mcp-test-service'

export function MCPSection() {
  const { settings, testResult, setEnabled, setTestResult, loadSettings } = useMCPStore()
  const [isTestLoading, setIsTestLoading] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleToggle = async () => {
    await setEnabled(!settings.enabled)
    // Reset test result when toggling
    if (!settings.enabled) {
      setTestResult({ status: 'idle' })
    }
  }

  const handleTest = async () => {
    if (!settings.serverUrl) return

    setIsTestLoading(true)
    setTestResult({ status: 'loading', timestamp: new Date().toISOString() })

    try {
      const result = await testMCPServer(settings.serverUrl)
      setTestResult(result)
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
    <section className="bg-card rounded-lg px-6 py-5 border border-border shadow-sm">
      <div className="flex items-start gap-4 mb-6">
        {/* Server Icon */}
        <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center flex-shrink-0 shadow-md">
          <Server className="w-6 h-6 text-white" strokeWidth={2} />
        </div>

        {/* Header Text */}
        <div className="flex-1">
          <h2 className="text-foreground text-[18px] font-medium leading-tight mb-1">
            MCP Server
          </h2>
          <p className="text-muted-foreground text-[14px] leading-normal">
            Connect to Model Context Protocol server
          </p>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-foreground text-[14px] font-normal">
          Enable MCP:
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

      {/* Server URL and Test Button (shown only when enabled) */}
      {settings.enabled && (
        <div className="space-y-3">
          {/* Server URL Display */}
          <div className="flex items-center gap-3">
            <label className="text-foreground text-[14px] font-normal min-w-[100px]">
              Server URL:
            </label>
            <div className="flex-1 bg-background border border-input rounded-lg px-4 py-2 text-foreground text-[14px] font-mono">
              {settings.serverUrl || 'Not configured'}
            </div>
          </div>

          {/* Test Button and Result */}
          <div className="flex items-center gap-3">
            <div className="min-w-[100px]" />
            <button
              onClick={handleTest}
              disabled={isTestLoading || !settings.serverUrl}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium
                transition-all border
                ${
                  isTestLoading || !settings.serverUrl
                    ? 'bg-muted text-muted-foreground border-muted cursor-not-allowed'
                    : 'bg-background border-input hover:border-brand hover:bg-brand/5 hover:text-brand'
                }
              `}
            >
              {getTestButtonContent()}
            </button>

            {/* Error Message */}
            {testResult.status === 'error' && testResult.error && (
              <span className="text-red-500 text-[13px]">
                {testResult.error}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
