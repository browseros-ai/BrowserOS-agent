import { Check, ChevronDown, Copy } from 'lucide-react'
import { type FC, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { templates } from './templates'

const sections = [
  {
    key: 'aboutYou' as const,
    title: 'Add more info about you',
    description: 'Help BrowserOS understand who you are',
  },
  {
    key: 'expectations' as const,
    title: 'What you expect from the browser',
    description: 'Share your preferences and needs',
  },
  {
    key: 'commonActions' as const,
    title: 'Your commonly performed actions',
    description: 'Describe your daily workflows',
  },
]

export const PromptTemplates: FC = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>(
    sections[0].key,
  )
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const copyTemplate = (templateKey: keyof typeof templates) => {
    const template = templates[templateKey].template
    navigator.clipboard.writeText(template)
    setCopiedSection(templateKey)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
        Need help getting started?
      </h2>
      <div className="space-y-2">
        {sections.map((section) => (
          <Collapsible
            key={section.key}
            open={expandedSection === section.key}
            onOpenChange={(open) =>
              setExpandedSection(open ? section.key : null)
            }
            className="w-full rounded-xl border border-border/50 bg-card hover:border-border"
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-auto w-full items-center justify-between p-4 text-left hover:bg-accent/50"
              >
                <div className="flex-1">
                  <h3 className="mb-1 font-medium text-foreground text-sm">
                    {section.title}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {section.description}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${expandedSection === section.key ? 'rotate-180' : ''}`}
                />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              <div className="space-y-3 px-4 pb-4">
                <div>
                  <p className="mb-2 font-medium text-muted-foreground text-xs">
                    Template (click to copy):
                  </p>
                  <div className="relative">
                    <pre className="styled-scrollbar overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-accent/50 p-4 text-foreground text-xs">
                      {templates[section.key].template}
                    </pre>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => copyTemplate(section.key)}
                      className="absolute top-3 right-3"
                      title="Copy template"
                    >
                      {copiedSection === section.key ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-medium text-muted-foreground text-xs">
                    Example:
                  </p>
                  <pre className="styled-scrollbar overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border/30 bg-muted/30 p-4 text-muted-foreground text-xs">
                    {templates[section.key].example}
                  </pre>
                </div>

                <p className="text-muted-foreground text-xs">
                  Copy a template, paste it into your prompt, and tailor it to
                  how you want BrowserOS to respond.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  )
}
