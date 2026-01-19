import { ChevronDown } from 'lucide-react'
import type { FC } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Feature } from '@/lib/browseros/capabilities'
import { useCapabilities } from '@/lib/browseros/useCapabilities'
import {
  type ProviderTemplate,
  providerTemplates,
} from '@/lib/llm-providers/providerTemplates'
import { cn } from '@/lib/utils'
import { ProviderTemplateCard } from './ProviderTemplateCard'

interface ProviderTemplatesSectionProps {
  onUseTemplate: (template: ProviderTemplate) => void
}

export const ProviderTemplatesSection: FC<ProviderTemplatesSectionProps> = ({
  onUseTemplate,
}) => {
  const { supports } = useCapabilities()

  const filteredTemplates = providerTemplates.filter((template) => {
    if (template.id === 'openai-compatible') {
      return supports(Feature.OPENAI_COMPATIBLE_SUPPORT)
    }
    return true
  })

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
        <CollapsibleTrigger className="mb-4 flex w-full items-center justify-between text-left">
          <div>
            <h3 className="font-semibold text-lg">Quick provider templates</h3>
            <p className="text-muted-foreground text-sm">
              {filteredTemplates.length} templates available
            </p>
          </div>
          <ChevronDown
            className={cn(
              'h-5 w-5 transition-transform',
              'group-data-[state=open]/collapsible:rotate-180',
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((template) => (
              <ProviderTemplateCard
                key={template.id}
                template={template}
                onUseTemplate={onUseTemplate}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
