import type * as React from 'react'
import type { FC } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { TabListItem } from './tab-list-item'
import { useAvailableTabs } from './use-available-tabs'

interface TabMentionPopoverProps {
  isOpen: boolean
  filterText: string
  selectedTabs: chrome.tabs.Tab[]
  onToggleTab: (tab: chrome.tabs.Tab) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLTextAreaElement | null>
}

export const TabMentionPopover: FC<TabMentionPopoverProps> = ({
  isOpen,
  filterText,
  selectedTabs,
  onToggleTab,
  onClose,
  anchorRef,
}) => {
  const { tabs, allTabs } = useAvailableTabs({ enabled: isOpen, filterText })
  const [focusedIndex, setFocusedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedTabIds = useMemo(
    () => new Set(selectedTabs.map((t) => t.id)),
    [selectedTabs],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset focus when filter changes
  useEffect(() => {
    setFocusedIndex(0)
  }, [filterText])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((prev) => (prev < tabs.length - 1 ? prev + 1 : prev))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break
        case 'Enter':
          e.preventDefault()
          if (tabs[focusedIndex]) {
            onToggleTab(tabs[focusedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'Tab':
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, tabs, focusedIndex, onToggleTab, onClose])

  useEffect(() => {
    if (listRef.current && focusedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-tab-item]')
      items[focusedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIndex])

  if (!isOpen) return null

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor
        virtualRef={anchorRef as React.RefObject<HTMLTextAreaElement>}
      />
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[calc(100vw-24px)] max-w-[400px] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        role="dialog"
        aria-label="Select tabs to attach"
      >
        <Command
          className="[&_svg:not([class*='text-'])]:text-muted-foreground"
          shouldFilter={false}
        >
          <div className="border-border/50 border-b px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                Attach Tabs
              </span>
              {filterText && (
                <span className="text-muted-foreground text-xs">
                  Filtering: "{filterText}"
                </span>
              )}
            </div>
            {selectedTabs.length > 0 && (
              <span className="mt-1 block text-[var(--accent-orange)] text-xs">
                {selectedTabs.length} tab{selectedTabs.length !== 1 ? 's' : ''}{' '}
                selected
              </span>
            )}
          </div>
          <CommandList
            ref={listRef}
            className="max-h-64 overflow-auto"
            role="listbox"
            aria-label="Available tabs"
            aria-multiselectable="true"
          >
            <CommandEmpty className="py-6 text-center">
              <div className="text-muted-foreground text-sm">
                {allTabs.length === 0
                  ? 'No active tabs'
                  : `No tabs matching "${filterText}"`}
              </div>
              <div className="mt-1 text-muted-foreground/70 text-xs">
                {allTabs.length === 0
                  ? 'Open some web pages to attach them'
                  : 'Try a different search term'}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {tabs.map((tab, index) => (
                <CommandItem
                  key={tab.id}
                  data-tab-item
                  value={`${tab.id}`}
                  onSelect={() => onToggleTab(tab)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className="p-0 data-[selected=true]:bg-transparent"
                >
                  <TabListItem
                    tab={tab}
                    isSelected={selectedTabIds.has(tab.id)}
                    className={index === focusedIndex ? 'bg-accent' : undefined}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-border/50 border-t px-3 py-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                <kbd className="rounded border border-border bg-muted px-1 py-0.5">
                  ↑↓
                </kbd>{' '}
                navigate
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1 py-0.5">
                  Enter
                </kbd>{' '}
                select
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1 py-0.5">
                  Esc
                </kbd>{' '}
                close
              </span>
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
