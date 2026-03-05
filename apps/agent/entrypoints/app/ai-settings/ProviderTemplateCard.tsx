import type { FC } from 'react'
import { Badge } from '@/components/ui/badge'
import { ProviderIcon } from '@/lib/llm-providers/providerIcons'
import type { ProviderTemplate } from '@/lib/llm-providers/providerTemplates'
import { cn } from '@/lib/utils'

interface ProviderTemplateCardProps {
  template: ProviderTemplate
  highlighted?: boolean
  onUseTemplate: (template: ProviderTemplate) => void
}

export const ProviderTemplateCard: FC<ProviderTemplateCardProps> = ({
  template,
  highlighted = false,
  onUseTemplate,
}) => {
  return (
    <button
      type="button"
      onClick={() => onUseTemplate(template)}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg border bg-background p-4 text-left transition-all hover:border-[var(--accent-orange)] hover:shadow-md',
        highlighted
          ? 'border-orange-400/60 shadow-[0_0_15px_rgba(251,146,60,0.25)] ring-2 ring-orange-400/40'
          : 'border-border',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ProviderIcon
          type={template.id}
          size={28}
          className="shrink-0 text-accent-orange/70 transition-colors group-hover:text-accent-orange"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{template.name}</span>
            {highlighted && (
              <span className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-0.5 font-semibold text-[10px] text-white">
                Recommended
              </span>
            )}
          </div>
        </div>
      </div>
      <Badge
        variant="outline"
        className={cn(
          'shrink-0 rounded-md px-3 py-1 transition-colors group-hover:border-[var(--accent-orange)] group-hover:text-[var(--accent-orange)]',
          highlighted &&
            'border-[var(--accent-orange)] text-[var(--accent-orange)]',
        )}
      >
        USE
      </Badge>
    </button>
  )
}
