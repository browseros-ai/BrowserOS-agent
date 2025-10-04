import React, { useState, useEffect } from 'react'
import { LLMProvider } from '../types/llm-settings'
import { LLMTestService, TestResult, PerformanceScore, BenchmarkResult } from '../services/llm-test-service'
import { Loader2, Zap, Brain, Shield, X, AlertCircle, Gauge, MapPin, GitBranch, FlaskConical, Pencil, Trash2, CheckCircle, Activity } from 'lucide-react'

interface ConfiguredModelsListProps {
  providers: LLMProvider[]
  defaultProvider: string
  onEditProvider: (provider: LLMProvider) => void
  onDeleteProvider: (providerId: string) => void
  onSelectProvider?: (providerId: string) => void
}


export function ConfiguredModelsList({
  providers,
  defaultProvider,
  onEditProvider,
  onDeleteProvider,
  onSelectProvider
}: ConfiguredModelsListProps) {
  const [selectedProviderId, setSelectedProviderId] = useState(defaultProvider || '1')
  const [testingProviders, setTestingProviders] = useState<Set<string>>(new Set())
  const [benchmarkingProviders, setBenchmarkingProviders] = useState<Set<string>>(new Set())
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(new Map())
  const [performanceScores, setPerformanceScores] = useState<Map<string, PerformanceScore>>(new Map())
  const [benchmarkResults, setBenchmarkResults] = useState<Map<string, BenchmarkResult>>(new Map())
  const [benchmarkProgress, setBenchmarkProgress] = useState<Map<string, string>>(new Map())
  const [showScores, setShowScores] = useState<Set<string>>(new Set())

  const testService = LLMTestService.getInstance()

  // Update selected provider when default changes
  useEffect(() => {
    if (defaultProvider) {
      setSelectedProviderId(defaultProvider)
    }
  }, [defaultProvider])

  useEffect(() => {
    providers.forEach(async (provider) => {
      if (provider.id) {
        const stored = await testService.getStoredResults(provider.id)
        if (stored) {
          if (stored.testResult) {
            setTestResults(prev => new Map(prev).set(provider.id, stored.testResult))
          }
          if (stored.performanceScores) {
            setPerformanceScores(prev => new Map(prev).set(provider.id, stored.performanceScores!))
          }
        }
      }
    })
  }, [providers])


  // Quick connectivity test
  const handleQuickTest = async (provider: LLMProvider) => {
    const providerId = provider.id
    setTestingProviders(prev => new Set(prev).add(providerId))

    // Close all other panels
    setShowScores(new Set([providerId]))

    try {
      const testResult = await testService.testProvider(provider)
      setTestResults(prev => new Map(prev).set(providerId, testResult))

      if (!testResult.success) {
        console.error('Test failed:', testResult.error)
        // Show error panel for failed tests
        setShowScores(prev => new Set(prev).add(providerId))
      } else if (testResult.response) {
        // Show success panel with response for successful tests
        setShowScores(prev => new Set(prev).add(providerId))
      }
    } catch (error) {
      console.error('Test failed:', error)
      const errorResult: TestResult = {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Test failed',
        timestamp: new Date().toISOString()
      }
      setTestResults(prev => new Map(prev).set(providerId, errorResult))
      // Show error panel
      setShowScores(prev => new Set(prev).add(providerId))
    } finally {
      setTestingProviders(prev => {
        const next = new Set(prev)
        next.delete(providerId)
        return next
      })
    }
  }

  // Full benchmark with performance scores
  const handleBenchmark = async (provider: LLMProvider) => {
    const providerId = provider.id
    setBenchmarkingProviders(prev => new Set(prev).add(providerId))
    setBenchmarkProgress(prev => new Map(prev).set(providerId, 'Starting benchmark...'))

    // Close all other panels
    setShowScores(new Set([providerId]))

    try {
      // Create progress callback
      const progressCallback = (progress: string) => {
        setBenchmarkProgress(prev => new Map(prev).set(providerId, progress))
      }

      setBenchmarkProgress(prev => new Map(prev).set(providerId, 'Starting benchmark...'))

      const benchmarkResult = await testService.benchmarkProvider(provider, progressCallback)
      setBenchmarkResults(prev => new Map(prev).set(providerId, benchmarkResult))

      if (benchmarkResult.success) {
        setPerformanceScores(prev => new Map(prev).set(providerId, benchmarkResult.scores))
        setShowScores(prev => new Set(prev).add(providerId))
        await testService.storeTestResults(providerId, benchmarkResult as any, benchmarkResult.scores)
      } else {
        // Remove any existing scores for failed tests
        setPerformanceScores(prev => {
          const next = new Map(prev)
          next.delete(providerId)
          return next
        })
        // Show error panel
        setShowScores(prev => new Set(prev).add(providerId))
        console.error('Benchmark failed:', benchmarkResult.error)
      }
    } catch (error) {
      console.error('Benchmark failed:', error)

      const errorResult: BenchmarkResult = {
        success: false,
        latency: 0,
        scores: {
          instructionFollowing: 0,
          contextUnderstanding: 0,
          toolUsage: 0,
          planning: 0,
          errorRecovery: 0,
          performance: 0,
          overall: 0
        },
        error: error instanceof Error ? error.message : 'Benchmark failed',
        timestamp: new Date().toISOString()
      }
      setBenchmarkResults(prev => new Map(prev).set(providerId, errorResult))
      // Remove any existing scores
      setPerformanceScores(prev => {
        const next = new Map(prev)
        next.delete(providerId)
        return next
      })
      // Show error panel
      setShowScores(prev => new Set(prev).add(providerId))
    } finally {
      setBenchmarkingProviders(prev => {
        const next = new Set(prev)
        next.delete(providerId)
        return next
      })
      setBenchmarkProgress(prev => {
        const next = new Map(prev)
        next.delete(providerId)
        return next
      })
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return '#81c995'
    if (score >= 6) return '#fbbc04'
    return '#f28b82'
  }

  const getProviderColor = (type: string) => {
    switch (type) {
      case 'openai': return '#10A37F'
      case 'anthropic': return '#D97757'
      case 'google_gemini': return '#FFFFFF'
      case 'ollama': return '#000000'
      case 'openrouter': return '#6B47ED'
      case 'browseros': return '#8B5CF6'
      default: return '#6B7280'
    }
  }

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'browseros':
        return <img src="/assets/browseros.svg" alt="BrowserOS" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '50%' }} />
      case 'openai':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}>
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
          </svg>
        )
      case 'anthropic':
        return <img src="/assets/claude-ai-icon.webp" alt="Claude" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
      case 'google_gemini':
        return <img src="/assets/Google-gemini-icon.svg.png" alt="Gemini" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
      case 'ollama':
        return <img src="/assets/ollama.png" alt="Ollama" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
      case 'openrouter':
        return <img src="/assets/open router.png" alt="OpenRouter" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
      case 'openai_compatible':
      case 'custom':
        return <img src="/assets/LM-studio.jpeg" alt="LM Studio" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
      default:
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )
    }
  }

  const closeTestResults = (providerId: string) => {
    setShowScores(prev => {
      const next = new Set(prev)
      next.delete(providerId)
      return next
    })
  }

  return (
    <section className="chrome-settings-card">
      <div className="chrome-settings-card-content">
        <h3 className="chrome-settings-section-title" style={{ marginBottom: '16px' }}>
          Configured Models
        </h3>

        <div className="chrome-settings-models-list">
          {providers.map((provider) => (
            <div key={provider.id}>
              <div
                className={`chrome-settings-model-item ${selectedProviderId === provider.id ? 'selected' : ''} ${provider.id === defaultProvider ? 'is-default' : ''}`}
                onClick={() => {
                  setSelectedProviderId(provider.id)
                  // Close all panels when selecting a provider
                  setShowScores(new Set())
                  // Sync with agent provider when selected
                  if (onSelectProvider) {
                    onSelectProvider(provider.id)
                  }
                }}
              >
                <div className="chrome-settings-model-content">
                  <div className="chrome-settings-model-radio" />

                  <div className="chrome-settings-model-info">
                    <div className="chrome-settings-model-icon">
                      {getProviderIcon(provider.type)}
                    </div>

                    <div className="chrome-settings-model-details">
                      <span className="chrome-settings-model-name">
                        {provider.name}
                      </span>
                      <span className="chrome-settings-model-description">
                        {provider.modelId ? `Model: ${provider.modelId}` : `Type: ${provider.type}`}
                      </span>
                    </div>

                    <div className="chrome-settings-model-badges">
                      {provider.id === defaultProvider && (
                        <span className="chrome-settings-model-badge default">
                          default
                        </span>
                      )}
                      {provider.isBuiltIn && (
                        <span className="chrome-settings-model-badge builtin">
                          built-in
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="chrome-settings-model-actions">
                  {/* Quick Test button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!provider.isBuiltIn) {
                        handleQuickTest(provider)
                      }
                    }}
                    className={`chrome-settings-action-button chrome-settings-action-test ${
                      testResults.get(provider.id)?.success === true ? 'success' :
                      testResults.get(provider.id)?.success === false ? 'error' : ''
                    }`}
                    disabled={testingProviders.has(provider.id) || benchmarkingProviders.has(provider.id) || provider.isBuiltIn}
                    style={{ visibility: provider.isBuiltIn ? 'hidden' : 'visible' }}
                    title={testResults.get(provider.id)?.success ?
                      `✓ Test passed (${Math.round(testResults.get(provider.id)!.latency)}ms)` :
                      testResults.get(provider.id)?.error || "Quick connectivity test"}
                  >
                    {testingProviders.has(provider.id) ? (
                      <Loader2 style={{ width: '12px', height: '12px' }} className="animate-spin" />
                    ) : testResults.get(provider.id) ? (
                      testResults.get(provider.id)?.success ? (
                        <CheckCircle style={{ width: '12px', height: '12px', color: '#81c995' }} />
                      ) : (
                        <AlertCircle style={{ width: '12px', height: '12px', color: '#f28b82' }} />
                      )
                    ) : (
                      <FlaskConical style={{ width: '12px', height: '12px' }} />
                    )}
                  </button>

                  {/* Benchmark button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!provider.isBuiltIn) {
                        handleBenchmark(provider)
                      }
                    }}
                    className={`chrome-settings-action-button chrome-settings-action-benchmark ${
                      benchmarkResults.get(provider.id)?.success ? 'success' : ''
                    }`}
                    disabled={testingProviders.has(provider.id) || benchmarkingProviders.has(provider.id) || provider.isBuiltIn}
                    style={{ visibility: provider.isBuiltIn ? 'hidden' : 'visible' }}
                    title="Performance benchmark"
                  >
                    {benchmarkingProviders.has(provider.id) ? (
                      <>
                        <Loader2 style={{ width: '12px', height: '12px' }} className="animate-spin" />
                        <span style={{ fontSize: '10px', marginLeft: '2px' }}>...</span>
                      </>
                    ) : benchmarkResults.get(provider.id)?.success ? (
                      <>
                        <Activity style={{ width: '12px', height: '12px' }} />
                        <span style={{ fontSize: '11px', marginLeft: '2px' }}>
                          {benchmarkResults.get(provider.id)?.scores.overall}/10
                        </span>
                      </>
                    ) : (
                      <Activity style={{ width: '12px', height: '12px' }} />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!provider.isBuiltIn) {
                        // Close all panels
                        setShowScores(new Set())
                        onEditProvider(provider)
                      }
                    }}
                    className="chrome-settings-action-button chrome-settings-action-edit"
                    disabled={provider.isBuiltIn}
                    style={{ visibility: provider.isBuiltIn ? 'hidden' : 'visible' }}
                  >
                    Edit
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!provider.isBuiltIn) {
                        // Close all panels
                        setShowScores(new Set())
                        onDeleteProvider(provider.id)
                      }
                    }}
                    className="chrome-settings-action-button chrome-settings-action-delete"
                    disabled={provider.isBuiltIn}
                    style={{ visibility: provider.isBuiltIn ? 'hidden' : 'visible' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {showScores.has(provider.id) && (
                <div className="chrome-settings-scores-panel" style={{ position: 'relative' }}>
                  <button
                    onClick={() => closeTestResults(provider.id)}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#9aa0a6',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      zIndex: 10
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.color = '#e8eaed'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                      e.currentTarget.style.color = '#9aa0a6'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Show test success with response */}
                  {testResults.get(provider.id)?.success && testResults.get(provider.id)?.response && !performanceScores.has(provider.id) ? (
                    <div style={{
                      padding: '20px',
                      paddingTop: '16px',
                      backgroundColor: 'rgba(129, 201, 149, 0.08)',
                      border: '1px solid rgba(129, 201, 149, 0.2)',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, rgba(129, 201, 149, 0.05) 0%, rgba(129, 201, 149, 0.03) 100%)'
                    }}>
                      <div style={{
                        color: '#81c995',
                        fontWeight: 600,
                        marginBottom: '12px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid rgba(129, 201, 149, 0.15)',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <CheckCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
                        Test Successful
                        <span style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.8 }}>
                          ({Math.round(testResults.get(provider.id)!.latency)}ms)
                        </span>
                      </div>
                      <div style={{
                        color: '#e8eaed',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '4px',
                        border: '1px solid rgba(129, 201, 149, 0.1)',
                        fontFamily: 'monospace'
                      }}>
                        <strong style={{ color: '#81c995' }}>Response:</strong> {testResults.get(provider.id)?.response}
                      </div>
                    </div>
                  ) : (testResults.get(provider.id) && !testResults.get(provider.id)?.success) ||
                   (benchmarkResults.get(provider.id) && !benchmarkResults.get(provider.id)?.success) ? (
                    <div style={{
                      padding: '20px',
                      paddingTop: '16px',
                      backgroundColor: 'rgba(248, 113, 113, 0.08)',
                      border: '1px solid rgba(248, 113, 113, 0.2)',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, rgba(248, 113, 113, 0.05) 0%, rgba(252, 165, 165, 0.03) 100%)'
                    }}>
                      <div style={{
                        color: '#f87171',
                        fontWeight: 600,
                        marginBottom: '12px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid rgba(248, 113, 113, 0.15)',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <AlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
                        {benchmarkResults.get(provider.id) && !benchmarkResults.get(provider.id)?.success
                          ? 'Test Failed'
                          : 'Connection Error'}
                      </div>
                      <div style={{
                        color: '#bdc1c6',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        opacity: 0.95
                      }}>
                        {(() => {
                          const testError = testResults.get(provider.id)?.error
                          const benchmarkError = benchmarkResults.get(provider.id)?.error
                          const error = benchmarkError || testError || ''

                          // More specific error matching
                          if (error.includes('401') || error.toLowerCase().includes('unauthorized') || error.toLowerCase().includes('api key')) {
                            return 'Invalid API key - Please check your API key in the provider settings and ensure it has not expired.'
                          } else if (error.includes('429') || error.toLowerCase().includes('rate limit')) {
                            return 'Rate limit exceeded - Your API has hit its rate limit. Please wait a moment before trying again.'
                          } else if (error.includes('403') || error.toLowerCase().includes('forbidden')) {
                            return 'Access forbidden - Check your API permissions or subscription status. Your key may not have access to this model.'
                          } else if (error.includes('404') || error.toLowerCase().includes('not found')) {
                            return 'Model not found - The specified model does not exist. Please verify the model name is correct.'
                          } else if (error.includes('500') || error.toLowerCase().includes('internal server')) {
                            return 'Provider server error - The service is experiencing issues. Please try again later.'
                          } else if (error.includes('502') || error.includes('503') || error.toLowerCase().includes('bad gateway')) {
                            return 'Service temporarily unavailable - The provider service is down. Please try again later.'
                          } else if (error.toLowerCase().includes('timeout')) {
                            return 'Request timed out - The provider took too long to respond. It may be overloaded or experiencing issues.'
                          } else if (error.toLowerCase().includes('network') || error.toLowerCase().includes('fetch') || error.toLowerCase().includes('connection')) {
                            return 'Network error - Unable to connect to the provider. Please check your internet connection and firewall settings.'
                          } else if (error.toLowerCase().includes('cors')) {
                            return 'CORS error - The provider does not support browser-based requests. Try using a different provider or base URL.'
                          } else if (error.toLowerCase().includes('invalid') || error.toLowerCase().includes('malformed')) {
                            return 'Invalid configuration - Please verify your provider settings including API key, base URL, and model name.'
                          } else if (error.toLowerCase().includes('quota') || error.toLowerCase().includes('limit exceeded')) {
                            return 'Quota exceeded - You have reached your API usage limit. Check your provider dashboard for details.'
                          } else if (error.toLowerCase().includes('billing') || error.toLowerCase().includes('payment')) {
                            return 'Billing issue - There is a problem with your account billing. Please check your payment method or subscription.'
                          } else {
                            // Show the raw error if we can't categorize it
                            return error || 'Failed to connect to the API. Please check your provider settings and try again.'
                          }
                        })()}
                      </div>
                    </div>
                  ) : performanceScores.has(provider.id) ? (
                    <>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px',
                        marginBottom: '16px'
                      }}>
                        <div className="chrome-settings-score-item">
                          <Zap className="w-4 h-4" style={{ color: getScoreColor(performanceScores.get(provider.id)!.instructionFollowing) }} />
                          <div>
                            <div className="chrome-settings-score-label">Instruction Following</div>
                            <div className="chrome-settings-score-value">
                              {performanceScores.get(provider.id)!.instructionFollowing}/10
                            </div>
                          </div>
                        </div>
                        <div className="chrome-settings-score-item">
                          <Brain className="w-4 h-4" style={{ color: getScoreColor(performanceScores.get(provider.id)!.contextUnderstanding) }} />
                          <div>
                            <div className="chrome-settings-score-label">Context Understanding</div>
                            <div className="chrome-settings-score-value">
                              {performanceScores.get(provider.id)!.contextUnderstanding}/10
                            </div>
                          </div>
                        </div>
                        <div className="chrome-settings-score-item">
                          <Shield className="w-4 h-4" style={{ color: getScoreColor(performanceScores.get(provider.id)!.toolUsage) }} />
                          <div>
                            <div className="chrome-settings-score-label">Tool Usage</div>
                            <div className="chrome-settings-score-value">
                              {performanceScores.get(provider.id)!.toolUsage}/10
                            </div>
                          </div>
                        </div>
                        <div className="chrome-settings-score-item">
                          <GitBranch className="w-4 h-4" style={{ color: getScoreColor(performanceScores.get(provider.id)!.planning) }} />
                          <div>
                            <div className="chrome-settings-score-label">Planning</div>
                            <div className="chrome-settings-score-value">
                              {performanceScores.get(provider.id)!.planning}/10
                            </div>
                          </div>
                        </div>
                        <div className="chrome-settings-score-item">
                          <AlertCircle className="w-4 h-4" style={{ color: getScoreColor(performanceScores.get(provider.id)!.errorRecovery) }} />
                          <div>
                            <div className="chrome-settings-score-label">Error Recovery</div>
                            <div className="chrome-settings-score-value">
                              {performanceScores.get(provider.id)!.errorRecovery}/10
                            </div>
                          </div>
                        </div>
                        <div className="chrome-settings-score-item">
                          <Gauge className="w-4 h-4" style={{ color: getScoreColor(performanceScores.get(provider.id)!.performance) }} />
                          <div>
                            <div className="chrome-settings-score-label">Performance</div>
                            <div className="chrome-settings-score-value">
                              {performanceScores.get(provider.id)!.performance}/10
                            </div>
                          </div>
                        </div>
                      </div>
                      {testResults.get(provider.id)?.latency && (
                        <div className="chrome-settings-test-info">
                          <div>Response time: {Math.round(testResults.get(provider.id)!.latency)}ms</div>
                          {testResults.get(provider.id)?.response && (
                            <div style={{
                              marginTop: '8px',
                              padding: '8px',
                              backgroundColor: 'rgba(138, 180, 248, 0.1)',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#e8eaed'
                            }}>
                              <strong>LLM Response:</strong> {testResults.get(provider.id)?.response}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              )}

              {/* Benchmark progress indicator */}
              {benchmarkingProviders.has(provider.id) && benchmarkProgress.has(provider.id) && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(26, 115, 232, 0.08)',
                  borderRadius: '4px',
                  marginTop: '8px',
                  marginBottom: '-8px',
                  fontSize: '12px',
                  color: 'var(--cr-link-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{benchmarkProgress.get(provider.id)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}