import { useQueryClient } from '@tanstack/react-query'
import { type FC, useMemo, useState } from 'react'
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
import { useSessionInfo } from '@/lib/auth/sessionStorage'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'
import { GetProfileIdByUserIdDocument } from '@/lib/conversations/graphql/uploadConversationDocument'
import { getQueryKeyFromDocument } from '@/lib/graphql/getQueryKeyFromDocument'
import { useGraphqlMutation } from '@/lib/graphql/useGraphqlMutation'
import { useGraphqlQuery } from '@/lib/graphql/useGraphqlQuery'
import type { ProviderTemplate } from '@/lib/llm-providers/providerTemplates'
import { testProvider } from '@/lib/llm-providers/testProvider'
import type { LlmProviderConfig } from '@/lib/llm-providers/types'
import { useLlmProviders } from '@/lib/llm-providers/useLlmProviders'
import { ConfiguredProvidersList } from './ConfiguredProvidersList'
import {
  DeleteRemoteLlmProviderDocument,
  GetRemoteLlmProvidersDocument,
} from './graphql/aiSettingsDocument'
import type { IncompleteProvider } from './IncompleteProviderCard'
import { IncompleteProvidersList } from './IncompleteProvidersList'
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
  const { baseUrl: agentServerUrl } = useAgentServerUrl()
  const { sessionInfo } = useSessionInfo()
  const queryClient = useQueryClient()

  const userId = sessionInfo.user?.id

  const { data: profileData } = useGraphqlQuery(
    GetProfileIdByUserIdDocument,
    { userId: userId! },
    { enabled: !!userId },
  )
  const profileId = profileData?.profileByUserId?.rowId

  const { data: remoteProvidersData } = useGraphqlQuery(
    GetRemoteLlmProvidersDocument,
    { profileId: profileId! },
    { enabled: !!profileId },
  )

  const deleteRemoteProviderMutation = useGraphqlMutation(
    DeleteRemoteLlmProviderDocument,
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [getQueryKeyFromDocument(GetRemoteLlmProvidersDocument)],
        })
      },
    },
  )

  const incompleteProviders = useMemo<IncompleteProvider[]>(() => {
    if (!remoteProvidersData?.llmProviders?.nodes) return []

    const localProviderIds = new Set(providers.map((p) => p.id))

    return remoteProvidersData.llmProviders.nodes
      .filter((node): node is NonNullable<typeof node> => node !== null)
      .filter((node) => !localProviderIds.has(node.rowId))
  }, [remoteProvidersData, providers])

  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [templateValues, setTemplateValues] = useState<
    Partial<LlmProviderConfig> | undefined
  >()
  const [editingProvider, setEditingProvider] =
    useState<LlmProviderConfig | null>(null)
  const [providerToDelete, setProviderToDelete] =
    useState<LlmProviderConfig | null>(null)
  const [incompleteProviderToDelete, setIncompleteProviderToDelete] =
    useState<IncompleteProvider | null>(null)
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
      deleteRemoteProviderMutation.mutate({ rowId: providerToDelete.id })
      setProviderToDelete(null)
    }
  }

  const handleAddKeysToIncomplete = (provider: IncompleteProvider) => {
    const timestamp = Date.now()
    setTemplateValues({
      id: provider.rowId,
      type: provider.type as LlmProviderConfig['type'],
      name: provider.name,
      baseUrl: provider.baseUrl ?? undefined,
      modelId: provider.modelId,
      supportsImages: provider.supportsImages,
      contextWindow: provider.contextWindow ?? 128000,
      temperature: provider.temperature ?? 0.2,
      resourceName: provider.resourceName ?? undefined,
      region: provider.region ?? undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    setIsNewDialogOpen(true)
  }

  const handleDeleteIncompleteProvider = (provider: IncompleteProvider) => {
    setIncompleteProviderToDelete(provider)
  }

  const confirmDeleteIncompleteProvider = () => {
    if (incompleteProviderToDelete) {
      deleteRemoteProviderMutation.mutate({
        rowId: incompleteProviderToDelete.rowId,
      })
      setIncompleteProviderToDelete(null)
    }
  }

  const handleSaveProvider = async (provider: LlmProviderConfig) => {
    await saveProvider(provider)
  }

  const handleSelectProvider = (providerId: string) => {
    setDefaultProvider(providerId)
  }

  const handleTestProvider = async (provider: LlmProviderConfig) => {
    if (!agentServerUrl) {
      toast.error('Test Failed', {
        description: (
          <span className="text-red-600 text-sm dark:text-red-400">
            Server URL not available
          </span>
        ),
        duration: 3000,
      })
      return
    }

    setTestingProviderId(provider.id)

    try {
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

      <IncompleteProvidersList
        providers={incompleteProviders}
        onAddKeys={handleAddKeysToIncomplete}
        onDelete={handleDeleteIncompleteProvider}
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

      <AlertDialog
        open={!!incompleteProviderToDelete}
        onOpenChange={(open) => !open && setIncompleteProviderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Synced Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "
              {incompleteProviderToDelete?.name}
              "? This will remove it from all your devices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteIncompleteProvider}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
