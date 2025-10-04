import React, { useState } from 'react'
import { ThemeProvider } from './components/ThemeProvider'
import { SettingsLayout } from './components/SettingsLayout'
import { LLMProvidersSection } from './components/LLMProvidersSection'
import { ProviderTemplates } from './components/ProviderTemplates'
import { ConfiguredModelsList } from './components/ConfiguredModelsList'
import { AddProviderModal } from './components/AddProviderModal'
import { useBrowserOSPrefs } from './hooks/useBrowserOSPrefs'
import { useOptionsStore } from './stores/optionsStore'
import { testLLMProvider, benchmarkLLMProvider } from './services/llm-test-service'
import { LLMProvider, TestResult } from './types/llm-settings'
import './styles.css'

export function OptionsNew() {
  const { providers, defaultProvider, setDefaultProvider, addProvider, updateProvider, deleteProvider } = useBrowserOSPrefs()
  const [isAddingProvider, setIsAddingProvider] = useState(false)
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [benchmarkProgress, setBenchmarkProgress] = useState<Record<string, string>>({})

  const handleUseTemplate = (template: LLMProvider) => {
    setEditingProvider(template)
    setIsAddingProvider(true)
  }

  const handleSaveProvider = async (provider: Partial<LLMProvider>) => {
    if (editingProvider?.id) {
      await updateProvider(provider as LLMProvider)
    } else {
      await addProvider(provider as LLMProvider)
    }
    setIsAddingProvider(false)
    setEditingProvider(null)
  }

  const handleTestProvider = async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return

    // Set loading state
    setTestResults(prev => ({
      ...prev,
      [providerId]: { status: 'loading', timestamp: new Date().toISOString() }
    }))

    try {
      const result = await testLLMProvider(provider)
      setTestResults(prev => ({
        ...prev,
        [providerId]: result
      }))
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Test failed',
          timestamp: new Date().toISOString()
        }
      }))
    }
  }

  const handleBenchmarkProvider = async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return

    // Set loading state with benchmark flag (using a dummy benchmark object)
    setTestResults(prev => ({
      ...prev,
      [providerId]: {
        status: 'loading' as const,
        timestamp: new Date().toISOString(),
        benchmark: {
          overallScore: 0,
          scores: {},
          summary: 'Running benchmark...'
        }
      }
    }))

    // Clear any previous progress
    setBenchmarkProgress(prev => ({
      ...prev,
      [providerId]: 'Initializing benchmark...'
    }))

    try {
      // Import the service to access the class directly
      const { LLMTestService } = await import('./services/llm-test-service')
      const service = LLMTestService.getInstance()

      // Use the service directly with progress callback
      const result = await service.benchmarkProvider(provider, (progressMessage: string) => {
        setBenchmarkProgress(prev => ({
          ...prev,
          [providerId]: progressMessage
        }))
      })

      // Convert BenchmarkResult to TestResult format
      if (result.success) {
        const scoresRecord: Record<string, number> = {
          instructionFollowing: result.scores.instructionFollowing,
          contextUnderstanding: result.scores.contextUnderstanding,
          toolUsage: result.scores.toolUsage,
          planning: result.scores.planning,
          errorRecovery: result.scores.errorRecovery,
          performance: result.scores.performance,
          overall: result.scores.overall
        }

        setTestResults(prev => ({
          ...prev,
          [providerId]: {
            status: 'success',
            responseTime: result.latency,
            timestamp: result.timestamp,
            benchmark: {
              overallScore: result.scores.overall,
              scores: scoresRecord,
              summary: generateBenchmarkSummary(result)
            }
          }
        }))
      } else {
        setTestResults(prev => ({
          ...prev,
          [providerId]: {
            status: 'error',
            error: result.error || 'Benchmark failed',
            timestamp: result.timestamp
          }
        }))
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Benchmark failed',
          timestamp: new Date().toISOString()
        }
      }))
    } finally {
      // Clear progress after completion
      setBenchmarkProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[providerId]
        return newProgress
      })
    }
  }

  // Helper function to generate benchmark summary
  function generateBenchmarkSummary(result: any): string {
    const { scores } = result
    const overall = scores.overall

    let summary = `Overall Score: ${overall.toFixed(1)}/10\n\n`

    if (overall >= 8) {
      summary += '🏆 Excellent Performance - Highly recommended for complex agent tasks\n'
    } else if (overall >= 6) {
      summary += '✅ Good Performance - Suitable for most automation tasks\n'
    } else if (overall >= 4) {
      summary += '⚠️ Moderate Performance - Best for simple tasks\n'
    } else {
      summary += '❌ Poor Performance - Not recommended for automation\n'
    }

    summary += '\nCategory Scores:\n'
    summary += `• Instruction Following: ${scores.instructionFollowing}/10\n`
    summary += `• Context Understanding: ${scores.contextUnderstanding}/10\n`
    summary += `• Tool Usage: ${scores.toolUsage}/10\n`
    summary += `• Planning: ${scores.planning}/10\n`
    summary += `• Error Recovery: ${scores.errorRecovery}/10\n`
    summary += `• Performance: ${scores.performance}/10`

    return summary
  }

  return (
    <ThemeProvider>
      <SettingsLayout>
        <div className="space-y-6">
          <LLMProvidersSection
            defaultProvider={defaultProvider}
            providers={providers}
            onDefaultChange={setDefaultProvider}
            onAddProvider={() => setIsAddingProvider(true)}
          />

          <ProviderTemplates onUseTemplate={handleUseTemplate} />

          <ConfiguredModelsList
            providers={providers}
            defaultProvider={defaultProvider}
            testResults={testResults}
            benchmarkProgress={benchmarkProgress}
            onSetDefault={setDefaultProvider}
            onTest={handleTestProvider}
            onBenchmark={handleBenchmarkProvider}
            onEdit={(provider) => {
              setEditingProvider(provider)
              setIsAddingProvider(true)
            }}
            onDelete={deleteProvider}
          />
        </div>

        <AddProviderModal
          isOpen={isAddingProvider}
          onClose={() => {
            setIsAddingProvider(false)
            setEditingProvider(null)
          }}
          onSave={handleSaveProvider}
          editProvider={editingProvider}
        />
      </SettingsLayout>
    </ThemeProvider>
  )
}