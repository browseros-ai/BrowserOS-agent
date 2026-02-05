import type { useCombobox } from 'downshift'
import { Globe, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import type { FC } from 'react'
import { cn } from '@/lib/utils'
import type { SuggestionItem, SuggestionSection } from './lib/suggestions/types'

type GetMenuProps = ReturnType<typeof useCombobox>['getMenuProps']
type GetItemProps = ReturnType<typeof useCombobox>['getItemProps']

interface SearchSuggestionsProps {
  getMenuProps: GetMenuProps
  getItemProps: GetItemProps
  sections: SuggestionSection[]
  highlightedIndex: number
}

const SectionTitle: FC<{ title: string }> = ({ title }) =>
  title ? (
    <div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
      {title}
    </div>
  ) : null

const SuggestionItemRenderer: FC<{
  item: SuggestionItem
  isHighlighted: boolean
  getItemProps: GetItemProps
  index: number
}> = ({ item, isHighlighted, getItemProps, index }) => {
  const baseClassName = cn(
    'ph-mask flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-foreground text-sm transition-colors cursor-pointer',
    isHighlighted
      ? 'border-border/70 bg-accent'
      : 'hover:border-border/50 hover:bg-accent/70',
  )

  switch (item.type) {
    case 'search':
      return (
        <li className={baseClassName} {...getItemProps({ item, index })}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/70">
            {item.engine.iconUrl ? (
              <img
                src={item.engine.iconUrl}
                alt={`${item.engine.label} icon`}
                className="h-5 w-5"
              />
            ) : item.engine.kind === 'llm' ? (
              <Sparkles className="h-4 w-4 text-[var(--accent-orange)]" />
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-foreground">
              {item.engine.label}
            </div>
            <div className="truncate text-muted-foreground text-xs">
              {item.query}
            </div>
          </div>
          <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
            {item.engine.kind === 'llm' ? 'AI' : 'Search'}
          </span>
        </li>
      )

    case 'ai-tab':
      return (
        <li className={baseClassName} {...getItemProps({ item, index })}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-orange)]/10 transition-colors group-hover:bg-[var(--accent-orange)]/20">
            <item.icon className="h-4 w-4 text-[var(--accent-orange)]" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-medium text-foreground text-sm">
              {item.name}
            </div>
            {item.description && (
              <div className="text-muted-foreground text-xs">
                {item.description}
              </div>
            )}
          </div>
        </li>
      )

    case 'browseros':
      return (
        <li className={baseClassName} {...getItemProps({ item, index })}>
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">Ask BrowserOS:</span>
          {item.message || 'Type a message...'}
        </li>
      )
  }
}

export const SearchSuggestions: FC<SearchSuggestionsProps> = ({
  getItemProps,
  getMenuProps,
  sections,
  highlightedIndex,
}) => {
  let globalIndex = 0

  return (
    <motion.ul
      {...getMenuProps()}
      className="styled-scrollbar flex max-h-72 flex-col gap-3 overflow-y-auto px-2"
      transition={{ duration: 0.2 }}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      {sections.map((section) => (
        <div key={section.id} className="px-3">
          <SectionTitle title={section.title} />
          {section.items.map((item) => {
            const currentIndex = globalIndex++
            return (
              <SuggestionItemRenderer
                key={item.id}
                item={item}
                isHighlighted={highlightedIndex === currentIndex}
                getItemProps={getItemProps}
                index={currentIndex}
              />
            )
          })}
        </div>
      ))}
    </motion.ul>
  )
}
