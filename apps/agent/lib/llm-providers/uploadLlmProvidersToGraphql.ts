import { GetProfileIdByUserIdDocument } from '@/lib/conversations/graphql/uploadConversationDocument'
import { execute } from '@/lib/graphql/execute'
import { sentry } from '@/lib/sentry/sentry'
import {
  CreateLlmProviderForUploadDocument,
  LlmProviderExistsDocument,
  UpdateLlmProviderForUploadDocument,
} from './graphql/uploadLlmProviderDocument'
import type { LlmProviderConfig } from './types'

export async function uploadLlmProvidersToGraphql(
  providers: LlmProviderConfig[],
  userId: string,
) {
  if (providers.length === 0) return

  const profileResult = await execute(GetProfileIdByUserIdDocument, { userId })
  const profileId = profileResult.profileByUserId?.rowId
  if (!profileId) return

  for (const provider of providers) {
    if (provider.type === 'browseros') continue

    try {
      const existsResult = await execute(LlmProviderExistsDocument, {
        rowId: provider.id,
      })

      const providerData = {
        rowId: provider.id,
        profileId,
        type: provider.type,
        name: provider.name,
        baseUrl: provider.baseUrl ?? null,
        modelId: provider.modelId,
        supportsImages: provider.supportsImages,
        contextWindow: provider.contextWindow,
        temperature: provider.temperature,
        resourceName: provider.resourceName ?? null,
        region: provider.region ?? null,
        createdAt: new Date(provider.createdAt).toISOString(),
        updatedAt: new Date(provider.updatedAt).toISOString(),
      }

      if (existsResult.llmProvider) {
        await execute(UpdateLlmProviderForUploadDocument, {
          input: {
            rowId: provider.id,
            patch: {
              type: providerData.type,
              name: providerData.name,
              baseUrl: providerData.baseUrl,
              modelId: providerData.modelId,
              supportsImages: providerData.supportsImages,
              contextWindow: providerData.contextWindow,
              temperature: providerData.temperature,
              resourceName: providerData.resourceName,
              region: providerData.region,
              updatedAt: providerData.updatedAt,
            },
          },
        })
      } else {
        await execute(CreateLlmProviderForUploadDocument, {
          input: {
            llmProvider: providerData,
          },
        })
      }
    } catch (error) {
      sentry.captureException(error, {
        extra: {
          providerId: provider.id,
          providerName: provider.name,
        },
      })
    }
  }
}
