import React from 'react'
import { BrowserOSProvider } from '@/lib/llm/settings/browserOSTypes'
import { ProviderCard } from './ProviderCard'

interface ProviderListProps {
  providers: BrowserOSProvider[]
  defaultProviderId: string
  onEdit: (provider: BrowserOSProvider) => void
  onDelete: (providerId: string) => void
  onSetDefault: (providerId: string) => void
}

export function ProviderList({
  providers,
  defaultProviderId,
  onEdit,
  onDelete,
  onSetDefault
}: ProviderListProps) {
  if (providers.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <p className="text-muted-foreground">No providers configured yet.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Click "Add custom provider" to get started or use one of the quick templates below.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          isDefault={provider.id === defaultProviderId}
          onEdit={() => onEdit(provider)}
          onDelete={() => onDelete(provider.id)}
          onSetDefault={() => onSetDefault(provider.id)}
        />
      ))}
    </div>
  )
}