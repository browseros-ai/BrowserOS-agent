import { zodResolver } from '@hookform/resolvers/zod'
import {
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  TerminalSquare,
  XCircle,
} from 'lucide-react'
import { type FC, useEffect, useEffectEvent, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v3'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Feature } from '@/lib/browseros/capabilities'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'
import { useCapabilities } from '@/lib/browseros/useCapabilities'
import { AI_PROVIDER_ADDED_EVENT } from '@/lib/constants/analyticsEvents'
import {
  type CodexStatus,
  getCodexStatus,
} from '@/lib/llm-providers/codexStatus'
import {
  getDefaultBaseUrlForProviders,
  getProviderTemplate,
  providerTypeOptions,
} from '@/lib/llm-providers/providerTemplates'
import { type TestResult, testProvider } from '@/lib/llm-providers/testProvider'
import type {
  LlmProviderConfig,
  ProviderAuthMode,
  ProviderType,
} from '@/lib/llm-providers/types'
import { track } from '@/lib/metrics/track'
import { getModelContextLength, getModelOptions } from './models'

const providerTypeEnum = z.enum([
  'moonshot',
  'anthropic',
  'openai',
  'codex',
  'openai-compatible',
  'google',
  'openrouter',
  'azure',
  'ollama',
  'lmstudio',
  'bedrock',
  'browseros',
])

/**
 * Zod schema for provider form validation
 * @public
 */
export const providerFormSchema = z
  .object({
    type: providerTypeEnum,
    name: z.string().min(1, 'Provider name is required').max(50),
    baseUrl: z.string().optional(),
    modelId: z.string().min(1, 'Model ID is required'),
    apiKey: z.string().optional(),
    authMode: z.enum(['chatgpt', 'api-key']).optional(),
    supportsImages: z.boolean(),
    contextWindow: z.number().int().min(1000).max(2000000),
    temperature: z.number().min(0).max(2),
    // Azure-specific
    resourceName: z.string().optional(),
    // Bedrock-specific
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    region: z.string().optional(),
    sessionToken: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'codex') {
      if (data.authMode === 'api-key' && !data.apiKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'API Key is required for Codex API key mode',
          path: ['apiKey'],
        })
      }
      return
    }

    // Azure: require either resourceName or baseUrl
    if (data.type === 'azure') {
      if (!data.resourceName && !data.baseUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Either Resource Name or Base URL is required',
          path: ['resourceName'],
        })
      }
      if (!data.apiKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'API Key is required for Azure',
          path: ['apiKey'],
        })
      }
    }
    // Bedrock: require AWS credentials
    else if (data.type === 'bedrock') {
      if (!data.accessKeyId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Access Key ID is required',
          path: ['accessKeyId'],
        })
      }
      if (!data.secretAccessKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Secret Access Key is required',
          path: ['secretAccessKey'],
        })
      }
      if (!data.region) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Region is required',
          path: ['region'],
        })
      }
    }
    // Other providers: require baseUrl
    else if (!data.baseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Base URL is required',
        path: ['baseUrl'],
      })
    } else if (!/^https?:\/\/.+/.test(data.baseUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a valid URL',
        path: ['baseUrl'],
      })
    }
  })

/**
 * Type for form values
 * @public
 */
export type ProviderFormValues = z.infer<typeof providerFormSchema>

/**
 * Props for NewProviderDialog
 * @public
 */
export interface NewProviderDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void
  /** Optional initial values for editing or template prefill */
  initialValues?: Partial<LlmProviderConfig>
  /** Callback when provider is saved */
  onSave: (provider: LlmProviderConfig) => Promise<void>
}

function getDefaultAuthMode(
  provider?: Partial<LlmProviderConfig>,
): ProviderAuthMode | undefined {
  if (provider?.type !== 'codex') {
    return provider?.authMode
  }

  return provider.authMode || 'chatgpt'
}

function buildProviderPayload(values: ProviderFormValues): ProviderFormValues {
  if (values.type !== 'codex') {
    return values
  }

  if (values.authMode === 'api-key') {
    return {
      ...values,
      baseUrl: undefined,
    }
  }

  return {
    ...values,
    apiKey: undefined,
    baseUrl: undefined,
    authMode: 'chatgpt',
  }
}

function canTestProvider(values: {
  type: ProviderType
  modelId: string
  authMode?: ProviderAuthMode
  apiKey?: string
  baseUrl?: string
  resourceName?: string
  accessKeyId?: string
  secretAccessKey?: string
  region?: string
}): boolean {
  if (!values.modelId) return false

  if (values.type === 'codex') {
    return values.authMode === 'api-key' ? !!values.apiKey : true
  }
  if (values.type === 'azure') {
    return !!(values.resourceName || values.baseUrl) && !!values.apiKey
  }
  if (values.type === 'bedrock') {
    return !!(values.accessKeyId && values.secretAccessKey && values.region)
  }

  if (!values.baseUrl) return false
  if (!['ollama', 'lmstudio'].includes(values.type) && !values.apiKey) {
    return false
  }

  return true
}

/**
 * Dialog for configuring a new LLM provider
 * @public
 */
export const NewProviderDialog: FC<NewProviderDialogProps> = ({
  open,
  onOpenChange,
  initialValues,
  onSave,
}) => {
  const [isCustomModel, setIsCustomModel] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [codexStatus, setCodexStatus] = useState<CodexStatus | null>(null)
  const [codexStatusError, setCodexStatusError] = useState<string | null>(null)
  const [isCodexStatusLoading, setIsCodexStatusLoading] = useState(false)
  const { supports } = useCapabilities()
  const { baseUrl: agentServerUrl } = useAgentServerUrl()

  const filteredProviderTypeOptions = providerTypeOptions.filter((opt) => {
    if (opt.value === 'openai-compatible') {
      return supports(Feature.OPENAI_COMPATIBLE_SUPPORT)
    }
    return true
  })

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      type: initialValues?.type || 'openai',
      name: initialValues?.name || '',
      baseUrl:
        initialValues?.baseUrl ||
        getDefaultBaseUrlForProviders(initialValues?.type || 'openai'),
      modelId: initialValues?.modelId || '',
      apiKey: initialValues?.apiKey || '',
      authMode: getDefaultAuthMode(initialValues),
      supportsImages: initialValues?.supportsImages ?? false,
      contextWindow: initialValues?.contextWindow || 128000,
      temperature: initialValues?.temperature ?? 0.2,
      // Azure-specific
      resourceName: initialValues?.resourceName || '',
      // Bedrock-specific
      accessKeyId: initialValues?.accessKeyId || '',
      secretAccessKey: initialValues?.secretAccessKey || '',
      region: initialValues?.region || '',
      sessionToken: initialValues?.sessionToken || '',
    },
  })

  const watchedType = form.watch('type')
  const watchedModelId = form.watch('modelId')
  const watchedAuthMode = form.watch('authMode')

  // Watch credential fields to clear test result when they change
  const watchedApiKey = form.watch('apiKey')
  const watchedBaseUrl = form.watch('baseUrl')
  const watchedResourceName = form.watch('resourceName')
  const watchedAccessKeyId = form.watch('accessKeyId')
  const watchedSecretAccessKey = form.watch('secretAccessKey')
  const watchedRegion = form.watch('region')
  const watchedSessionToken = form.watch('sessionToken')

  // Clear test result when credential fields change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional - clear result when any credential changes
  useEffect(() => {
    setTestResult(null)
  }, [
    watchedType,
    watchedModelId,
    watchedApiKey,
    watchedAuthMode,
    watchedBaseUrl,
    watchedResourceName,
    watchedAccessKeyId,
    watchedSecretAccessKey,
    watchedRegion,
    watchedSessionToken,
  ])

  const resolvedCodexAuthMode =
    watchedType === 'codex'
      ? ((watchedAuthMode || 'chatgpt') as ProviderAuthMode)
      : undefined

  // Get model options for current provider type
  const modelOptions = getModelOptions(
    watchedType as ProviderType,
    resolvedCodexAuthMode,
  )

  const refreshCodexStatus = useEffectEvent(async () => {
    if (!agentServerUrl) {
      setCodexStatus(null)
      setCodexStatusError('Server URL not available')
      return
    }

    setIsCodexStatusLoading(true)
    setCodexStatusError(null)

    try {
      const nextStatus = await getCodexStatus(agentServerUrl)
      setCodexStatus(nextStatus)
    } catch (error) {
      setCodexStatus(null)
      setCodexStatusError(
        error instanceof Error ? error.message : 'Failed to load Codex status',
      )
    } finally {
      setIsCodexStatusLoading(false)
    }
  })

  // Handle provider type change (user-initiated via Select)
  const handleTypeChange = (newType: ProviderType) => {
    form.setValue('type', newType)
    const defaultUrl = getDefaultBaseUrlForProviders(newType)
    if (defaultUrl) {
      form.setValue('baseUrl', defaultUrl)
    } else {
      form.setValue('baseUrl', '')
    }
    form.setValue('authMode', newType === 'codex' ? 'chatgpt' : undefined)
    form.setValue('modelId', '')
    setIsCustomModel(false)
  }

  const handleCodexAuthModeChange = (authMode: ProviderAuthMode) => {
    form.setValue('authMode', authMode)

    if (watchedType !== 'codex' || isCustomModel) return

    const nextModelOptions = getModelOptions('codex', authMode).filter(
      (modelId) => modelId !== 'custom',
    )

    if (!watchedModelId || nextModelOptions.includes(watchedModelId)) {
      return
    }

    const nextModelId = nextModelOptions[0] || ''
    form.setValue('modelId', nextModelId)

    if (!nextModelId) return

    const contextLength = getModelContextLength('codex', nextModelId, authMode)
    if (contextLength) {
      form.setValue('contextWindow', contextLength)
    }
  }

  // Auto-fill context window when model changes (only for new providers)
  useEffect(() => {
    if (initialValues?.id) return

    if (watchedModelId && watchedModelId !== 'custom') {
      const contextLength = getModelContextLength(
        watchedType as ProviderType,
        watchedModelId,
        resolvedCodexAuthMode,
      )
      if (contextLength) {
        form.setValue('contextWindow', contextLength)
      }
    }
  }, [
    watchedModelId,
    watchedType,
    resolvedCodexAuthMode,
    form,
    initialValues?.id,
  ])

  // Handle model selection (including custom option)
  const handleModelChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomModel(true)
      form.setValue('modelId', '')
    } else {
      setIsCustomModel(false)
      form.setValue('modelId', value)
    }
  }

  // Reset form when initialValues change
  useEffect(() => {
    if (initialValues) {
      form.reset({
        type: initialValues.type || 'openai',
        name: initialValues.name || '',
        baseUrl:
          initialValues.baseUrl ||
          getDefaultBaseUrlForProviders(initialValues.type || 'openai'),
        modelId: initialValues.modelId || '',
        apiKey: initialValues.apiKey || '',
        authMode: getDefaultAuthMode(initialValues),
        supportsImages: initialValues.supportsImages ?? false,
        contextWindow: initialValues.contextWindow || 128000,
        temperature: initialValues.temperature ?? 0.2,
        // Azure-specific
        resourceName: initialValues.resourceName || '',
        // Bedrock-specific
        accessKeyId: initialValues.accessKeyId || '',
        secretAccessKey: initialValues.secretAccessKey || '',
        region: initialValues.region || '',
        sessionToken: initialValues.sessionToken || '',
      })
      setIsCustomModel(false)
    }
  }, [initialValues, form])

  // Reset form when dialog opens fresh (no initial values)
  useEffect(() => {
    if (open && !initialValues) {
      const defaultType = 'openai'
      form.reset({
        type: defaultType,
        name: '',
        baseUrl: getDefaultBaseUrlForProviders(defaultType),
        modelId: '',
        apiKey: '',
        authMode: undefined,
        supportsImages: false,
        contextWindow: 128000,
        temperature: 0.2,
        // Azure-specific
        resourceName: '',
        // Bedrock-specific
        accessKeyId: '',
        secretAccessKey: '',
        region: '',
        sessionToken: '',
      })
      setIsCustomModel(false)
    }
    // Clear test result when dialog opens/closes
    setTestResult(null)
  }, [open, initialValues, form])

  useEffect(() => {
    if (open && watchedType === 'codex') {
      refreshCodexStatus().catch(() => {})
      return
    }

    setCodexStatus(null)
    setCodexStatusError(null)
  }, [open, watchedType])

  const onSubmit = async (values: ProviderFormValues) => {
    const isNewProvider = !initialValues?.id
    const normalizedValues = buildProviderPayload(values)
    const provider: LlmProviderConfig = {
      id: initialValues?.id || crypto.randomUUID(),
      ...normalizedValues,
      createdAt: initialValues?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }

    await onSave(provider)
    if (isNewProvider) {
      track(AI_PROVIDER_ADDED_EVENT, {
        provider_type: normalizedValues.type,
        model: normalizedValues.modelId,
      })
    }
    form.reset()
    onOpenChange(false)
  }

  // Check if we have enough info to test the connection
  const canTest = (): boolean => {
    return canTestProvider({
      type: watchedType,
      modelId: watchedModelId,
      authMode: resolvedCodexAuthMode,
      apiKey: watchedApiKey,
      baseUrl: watchedBaseUrl,
      resourceName: watchedResourceName,
      accessKeyId: watchedAccessKeyId,
      secretAccessKey: watchedSecretAccessKey,
      region: watchedRegion,
    })
  }

  const handleTest = async () => {
    if (!agentServerUrl) {
      setTestResult({
        success: false,
        message: 'Server URL not available',
      })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const values = buildProviderPayload(form.getValues())

      const result = await testProvider(
        {
          id: 'test',
          type: values.type,
          name: values.name || 'Test',
          baseUrl: values.baseUrl,
          modelId: values.modelId,
          apiKey: values.apiKey,
          authMode: values.authMode,
          supportsImages: values.supportsImages,
          contextWindow: values.contextWindow,
          temperature: values.temperature,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          resourceName: values.resourceName,
          accessKeyId: values.accessKeyId,
          secretAccessKey: values.secretAccessKey,
          region: values.region,
          sessionToken: values.sessionToken,
        },
        agentServerUrl,
      )

      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const providerTemplate = getProviderTemplate(watchedType as ProviderType)
  const setupGuideUrl = providerTemplate?.setupGuideUrl
  const providerName = providerTemplate?.name
  const setupGuideText =
    watchedType === 'moonshot'
      ? 'How to get a Kimi API key'
      : providerName
        ? `${providerName} setup guide`
        : 'Provider setup guide'

  const handleSetupGuideClick = (
    e: React.MouseEvent,
    url: string | undefined = setupGuideUrl,
  ) => {
    e.preventDefault()
    if (url) chrome.tabs.create({ url })
  }

  const renderProviderSpecificFields = () => {
    if (watchedType === 'codex') {
      const codexAuthMode = (watchedAuthMode || 'chatgpt') as ProviderAuthMode
      const hasChatGptStatus = !codexStatusError && codexStatus?.canUseChatGpt

      return (
        <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-medium text-sm">Codex Authentication</h4>
              <p className="mt-1 text-muted-foreground text-sm">
                Use your local Codex ChatGPT login or provide an OpenAI API key.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => refreshCodexStatus().catch(() => {})}
              disabled={isCodexStatusLoading}
            >
              {isCodexStatusLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          <FormField
            control={form.control}
            name="authMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authentication Method</FormLabel>
                <FormControl>
                  <Tabs
                    value={(field.value || 'chatgpt') as string}
                    onValueChange={(value) =>
                      handleCodexAuthModeChange(value as ProviderAuthMode)
                    }
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="chatgpt">
                        Sign in with ChatGPT
                      </TabsTrigger>
                      <TabsTrigger value="api-key">Use API key</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FormControl>
                <FormDescription>
                  ChatGPT mode reuses the local Codex login on this device.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {codexAuthMode === 'chatgpt' ? (
            <>
              <Alert
                className={
                  hasChatGptStatus
                    ? 'border-green-200 bg-green-50/70 text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100'
                    : 'border-border bg-background/70'
                }
              >
                <Info />
                <AlertTitle>Reuse your local Codex login</AlertTitle>
                <AlertDescription>
                  <p>
                    {codexStatus?.message ||
                      codexStatusError ||
                      'Run `codex login` on this machine, then refresh the status.'}
                  </p>
                  <p className="font-mono text-[11px]">
                    {codexStatus?.authPath || '~/.codex/auth.json'}
                  </p>
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border border-border border-dashed bg-background/60 p-3">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <TerminalSquare className="h-4 w-4 text-[var(--accent-orange)]" />
                  Terminal setup
                </div>
                <div className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
                  <p>codex login</p>
                  <p>codex login --device-auth</p>
                </div>
                <p className="mt-3 text-muted-foreground text-xs">
                  BrowserOS reads the Codex login already stored by the CLI on
                  this machine.{' '}
                  {setupGuideUrl && (
                    <a
                      href={setupGuideUrl}
                      onClick={(e) => handleSetupGuideClick(e, setupGuideUrl)}
                      className="inline-flex cursor-pointer items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Codex auth guide
                    </a>
                  )}
                </p>
              </div>
            </>
          ) : (
            <>
              <Alert className="border-border bg-background/70">
                <Info />
                <AlertTitle>Paste an OpenAI API key</AlertTitle>
                <AlertDescription>
                  <p>
                    BrowserOS cannot recover a key from an existing Codex CLI
                    API-key login. Create or copy a key and paste it below.
                  </p>
                  {providerTemplate?.apiKeyUrl && (
                    <p>
                      <a
                        href={providerTemplate.apiKeyUrl}
                        onClick={(e) =>
                          handleSetupGuideClick(e, providerTemplate.apiKeyUrl)
                        }
                        className="inline-flex cursor-pointer items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        OpenAI API keys
                      </a>
                    </p>
                  )}
                </AlertDescription>
              </Alert>

              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key *</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your OpenAI API key"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Stored locally in BrowserOS and not synced to your other
                      devices.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </div>
      )
    }

    if (watchedType === 'azure') {
      return (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="resourceName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="your-resource-name" {...field} />
                  </FormControl>
                  <FormDescription>Azure OpenAI resource name</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base URL Override</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional custom URL" {...field} />
                  </FormControl>
                  <FormDescription>
                    Overrides resource name if set
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key *</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter your Azure API key"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )
    }

    if (watchedType === 'bedrock') {
      return (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="accessKeyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Key ID *</FormLabel>
                  <FormControl>
                    <Input placeholder="AKIA..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="secretAccessKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secret Access Key *</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter your secret access key"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region *</FormLabel>
                  <FormControl>
                    <Input placeholder="us-east-1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sessionToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Token</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Optional (for STS credentials)"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Required for temporary credentials
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </>
      )
    }

    // Standard providers (OpenAI, Anthropic, Google, etc.)
    return (
      <>
        <FormField
          control={form.control}
          name="baseUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Base URL *</FormLabel>
              <FormControl>
                <Input placeholder="https://api.openai.com/v1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => {
            const isApiKeyOptional = ['ollama', 'lmstudio'].includes(
              watchedType,
            )
            return (
              <FormItem>
                <FormLabel>API Key{isApiKeyOptional ? '' : ' *'}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={
                      isApiKeyOptional
                        ? 'Enter your API key (optional)'
                        : 'Enter your API key'
                    }
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Your API key is encrypted and stored locally.{' '}
                  {setupGuideUrl && (
                    <a
                      href={setupGuideUrl}
                      onClick={(e) => handleSetupGuideClick(e, setupGuideUrl)}
                      className="inline-flex cursor-pointer items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {setupGuideText}
                    </a>
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )
          }}
        />
      </>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initialValues?.id ? 'Edit Provider' : 'Configure New Provider'}
          </DialogTitle>
          <DialogDescription>
            {initialValues?.id
              ? 'Update your LLM provider configuration.'
              : 'Add a new LLM provider configuration with API key and model settings.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Row 1: Provider Type & Name */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider Type *</FormLabel>
                    <Select
                      onValueChange={(v) => handleTypeChange(v as ProviderType)}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select provider type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredProviderTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Work OpenAI" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {renderProviderSpecificFields()}

            {/* Model field - shown for all providers */}
            <FormField
              control={form.control}
              name="modelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model *</FormLabel>
                  {isCustomModel || modelOptions.length === 1 ? (
                    <>
                      <FormControl>
                        <Input
                          placeholder={
                            watchedType === 'azure'
                              ? 'Enter your deployment name'
                              : watchedType === 'bedrock'
                                ? 'e.g., anthropic.claude-3-5-sonnet-20241022-v2:0'
                                : 'Enter custom model ID'
                          }
                          {...field}
                        />
                      </FormControl>
                      {modelOptions.length > 1 && (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => setIsCustomModel(false)}
                        >
                          ← Back to model list
                        </Button>
                      )}
                    </>
                  ) : (
                    <Select
                      onValueChange={handleModelChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {modelOptions.map((modelId) => (
                          <SelectItem key={modelId} value={modelId}>
                            {modelId === 'custom' ? '+ Custom model' : modelId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Model Configuration */}
            <div className="space-y-4 border-border border-t pt-4">
              <h4 className="font-medium text-sm">Model Configuration</h4>
              <FormField
                control={form.control}
                name="supportsImages"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Supports Images
                    </FormLabel>
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contextWindow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Context Window Size</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Auto-filled based on model
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperature (0-2)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Controls response randomness
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Test Result Banner */}
            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                  testResult.success
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span className="flex-1">{testResult.message}</span>
                {testResult.responseTime && (
                  <span className="text-xs opacity-70">
                    {testResult.responseTime}ms
                  </span>
                )}
              </div>
            )}

            <DialogFooter className="gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={!canTest() || isTesting}
              >
                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isTesting ? 'Testing...' : 'Test'}
              </Button>
              <Button type="submit" disabled={isTesting}>
                {initialValues?.id ? 'Update' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
