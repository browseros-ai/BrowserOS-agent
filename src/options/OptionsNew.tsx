import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { SettingsLayout } from './components/SettingsLayout'
import { LLMProvidersSection } from './components/LLMProvidersSection'
import { BrowserOSPromptEditor } from './components/BrowserOSPromptEditor'
import { ProviderTemplates } from './components/ProviderTemplates'
import { ConfiguredModelsList } from './components/ConfiguredModelsList'
import { AddProviderModal } from './components/AddProviderModal'
import { useBrowserOSPrefs } from './hooks/useBrowserOSPrefs'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'
import { testLLMProvider } from './services/llm-test-service'
import { LLMProvider, TestResult } from './types/llm-settings'
import { Bot, FileText } from 'lucide-react'
import './styles.css'

export function OptionsNew() {
  const { providers, defaultProvider, setDefaultProvider, addProvider, updateProvider, deleteProvider } = useBrowserOSPrefs()
  const { theme } = useSettingsStore()
  const [isAddingProvider, setIsAddingProvider] = useState(false)
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

  // Apply theme on mount and when it changes
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'gray')
    if (theme === 'dark') root.classList.add('dark')
    if (theme === 'gray') root.classList.add('gray')
  }, [theme])

  // Listen for theme changes from other tabs/views
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nxtscape-settings' && e.newValue) {
        try {
          const newSettings = JSON.parse(e.newValue)
          const newTheme = newSettings?.state?.theme

          if (newTheme && newTheme !== theme) {
            const root = document.documentElement
            root.classList.remove('dark', 'gray')
            if (newTheme === 'dark') root.classList.add('dark')
            if (newTheme === 'gray') root.classList.add('gray')
            // Force store update
            useSettingsStore.setState({ theme: newTheme })
          }
        } catch (err) {
          console.error('Failed to parse settings from storage:', err)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [theme])

  const handleUseTemplate = useCallback((template: LLMProvider) => {
    setEditingProvider(template)
    setIsAddingProvider(true)
  }, [setEditingProvider, setIsAddingProvider])

  const browserOSProvider = useMemo(
    () => providers.find(provider => provider.id === 'browseros'),
    [providers]
  )

  const handleSaveBrowserOSPrompt = useCallback(async (prompt: string) => {
    const currentBrowserOSProvider = providers.find(provider => provider.id === 'browseros')
    if (!currentBrowserOSProvider) {
      throw new Error('BrowserOS provider not found')
    }
    await updateProvider({
      ...currentBrowserOSProvider,
      systemPrompt: prompt
    })
  }, [providers, updateProvider])

  const handleSaveProvider = useCallback(async (provider: Partial<LLMProvider>) => {
    try {
      if (editingProvider?.id) {
        await updateProvider(provider as LLMProvider)
      } else {
        await addProvider(provider as LLMProvider)
      }
      setIsAddingProvider(false)
      setEditingProvider(null)
    } catch (error) {
      // Show error to user - the error will be displayed in the modal
      throw error
    }
  }, [editingProvider, updateProvider, addProvider])

  const handleTestProvider = useCallback(async (providerId: string) => {
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
  }, [providers, testLLMProvider])

  const sections = useMemo(() => [
    {
      id: 'browseros-ai',
      label: 'BrowserOS AI',
      icon: Bot,
      content: (
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
            onSetDefault={setDefaultProvider}
            onTest={handleTestProvider}
            onEdit={(provider) => {
              setEditingProvider(provider)
              setIsAddingProvider(true)
            }}
            onDelete={deleteProvider}
            onClearTestResult={(providerId) => {
              setTestResults(prev => {
                const newResults = { ...prev }
                delete newResults[providerId]
                return newResults
              })
            }}
          />
        </div>
      )
    },
    {
      id: 'browseros-system-prompt',
      label: 'BrowserOS system prompt',
      icon: FileText,
      content: (
        <BrowserOSPromptEditor
          provider={browserOSProvider}
          onSave={handleSaveBrowserOSPrompt}
        />
      )
    }
  ], [
    browserOSProvider,
    defaultProvider,
    providers,
    setDefaultProvider,
    testResults,
    handleUseTemplate,
    handleSaveBrowserOSPrompt,
    handleTestProvider,
    deleteProvider
  ])

  return (
    <>
      <SettingsLayout sections={sections} />

      <AddProviderModal
        isOpen={isAddingProvider}
        onClose={() => {
          setIsAddingProvider(false)
          setEditingProvider(null)
        }}
        onSave={handleSaveProvider}
        editProvider={editingProvider}
      />
    </>
  )
}
