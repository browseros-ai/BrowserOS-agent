import { type FC, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getAgentServerUrl } from '@/lib/browseros/helpers'
import type { ProviderTemplate } from '@/lib/llm-providers/providerTemplates'
import { testProvider } from '@/lib/llm-providers/testProvider'
import type { LlmProviderConfig } from '@/lib/llm-providers/types'
import { useLlmProviders } from '@/lib/llm-providers/useLlmProviders'
import { ConfiguredProvidersList } from './ConfiguredProvidersList'
import { LlmProvidersHeader } from './LlmProvidersHeader'
import { NewProviderDialog } from './NewProviderDialog'
import { ProviderTemplatesSection } from './ProviderTemplatesSection'

/**
 * AI Settings page for managing LLM providers
 * @public
 */
export const AISettingsPage: FC = () => {
  const {
    providers,
    defaultProviderId,
    saveProvider,
    setDefaultProvider,
    deleteProvider,
  } = useLlmProviders()

  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [templateValues, setTemplateValues] = useState<
    Partial<LlmProviderConfig> | undefined
  >()
  const [editingProvider, setEditingProvider] =
    useState<LlmProviderConfig | null>(null)
  const [providerToDelete, setProviderToDelete] =
    useState<LlmProviderConfig | null>(null)
  const [testingProviderId, setTestingProviderId] = useState<string | null>(
    null,
  )

  const handleAddProvider = () => {
    setTemplateValues(undefined)
    setIsNewDialogOpen(true)
  }

  const handleUseTemplate = (template: ProviderTemplate) => {
    setTemplateValues({
      type: template.id,
      name: template.name,
      baseUrl: template.defaultBaseUrl,
      modelId: template.defaultModelId,
      supportsImages: template.supportsImages,
      contextWindow: template.contextWindow,
      temperature: 0.2,
    })
    setIsNewDialogOpen(true)
  }

  const handleEditProvider = (provider: LlmProviderConfig) => {
    setEditingProvider(provider)
    setIsEditDialogOpen(true)
  }

  const handleDeleteProvider = (provider: LlmProviderConfig) => {
    setProviderToDelete(provider)
  }

  const confirmDeleteProvider = async () => {
    if (providerToDelete) {
      await deleteProvider(providerToDelete.id)
      setProviderToDelete(null)
    }
  }

  const handleSaveProvider = async (provider: LlmProviderConfig) => {
    await saveProvider(provider)
  }

  const handleSelectProvider = (providerId: string) => {
    setDefaultProvider(providerId)
  }

  const handleTestProvider = async (provider: LlmProviderConfig) => {
    setTestingProviderId(provider.id)

    try {
      const agentServerUrl = await getAgentServerUrl()
      const result = await testProvider(provider, agentServerUrl)

      if (result.success) {
        toast.success('Test Successful', {
          description: (
            <span className="text-green-600 text-sm dark:text-green-400">
              {result.message}
            </span>
          ),
          duration: 3000,
        })
      } else {
        toast.error('Test Failed', {
          description: (
            <span className="text-red-600 text-sm dark:text-red-400">
              {result.message}
            </span>
          ),
          duration: 3000,
        })
      }
    } catch (error) {
      toast.error('Test Failed', {
        description: (
          <span className="text-red-600 text-sm dark:text-red-400">
            {error instanceof Error ? error.message : 'Unknown error'}
          </span>
        ),
        duration: 3000,
      })
    }

    setTestingProviderId(null)
  }

  return (
    <div className="fade-in slide-in-from-bottom-5 animate-in space-y-6 duration-500">
      <LlmProvidersHeader
        providers={providers}
        defaultProviderId={defaultProviderId}
        onDefaultProviderChange={setDefaultProvider}
        onAddProvider={handleAddProvider}
      />

      <ProviderTemplatesSection onUseTemplate={handleUseTemplate} />

      <ConfiguredProvidersList
        providers={providers}
        selectedProviderId={defaultProviderId}
        testingProviderId={testingProviderId}
        onSelectProvider={handleSelectProvider}
        onTestProvider={handleTestProvider}
        onEditProvider={handleEditProvider}
        onDeleteProvider={handleDeleteProvider}
      />

      <NewProviderDialog
        open={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
        initialValues={templateValues}
        onSave={handleSaveProvider}
      />

      <NewProviderDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        initialValues={editingProvider ?? undefined}
        onSave={handleSaveProvider}
      />

      <AlertDialog
        open={!!providerToDelete}
        onOpenChange={(open) => !open && setProviderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{providerToDelete?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProvider}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
