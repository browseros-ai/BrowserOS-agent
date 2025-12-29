import type { FC } from 'react'
import { Badge } from '@/components/ui/badge'
import { ProviderIcon } from '@/lib/llm-providers/providerIcons'
import type { ProviderTemplate } from '@/lib/llm-providers/providerTemplates'

interface ProviderTemplateCardProps {
  template: ProviderTemplate
  onUseTemplate: (template: ProviderTemplate) => void
}

export const ProviderTemplateCard: FC<ProviderTemplateCardProps> = ({
  template,
  onUseTemplate,
}) => {
  return (
    <button
      type="button"
      onClick={() => onUseTemplate(template)}
      className="group flex w-full items-center justify-between rounded-lg border border-border bg-background p-4 text-left transition-all hover:border-[var(--accent-orange)] hover:shadow-md"
    >
      <div className="flex items-center gap-3 text-muted-foreground group-hover:text-[var(--accent-orange)]">
        <ProviderIcon type={template.id} size={28} />
        <span className="font-medium text-foreground">{template.name}</span>
      </div>
      <Badge
        variant="outline"
        className="rounded-md px-3 py-1 transition-colors group-hover:border-[var(--accent-orange)] group-hover:text-[var(--accent-orange)]"
      >
        USE
      </Badge>
    </button>
  )
}
