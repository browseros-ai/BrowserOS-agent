import { Check, Globe } from 'lucide-react'
import type { FC, RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface TabMentionPopoverProps {
  isOpen: boolean
  filterText: string
  selectedTabs: chrome.tabs.Tab[]
  onToggleTab: (tab: chrome.tabs.Tab) => void
  onClose: () => void
  anchorRef: RefObject<HTMLTextAreaElement | null>
}

export const TabMentionPopover: FC<TabMentionPopoverProps> = ({
  isOpen,
  filterText,
  selectedTabs,
  onToggleTab,
  onClose,
  anchorRef,
}) => {
  const [availableTabs, setAvailableTabs] = useState<chrome.tabs.Tab[]>([])
  const [focusedIndex, setFocusedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const fetchTabs = async () => {
      const currentWindowTabs = await chrome.tabs.query({ currentWindow: true })
      const tabs = currentWindowTabs.filter((tab) =>
        tab.url?.startsWith('http'),
      )
      setAvailableTabs(tabs)
    }

    fetchTabs()
  }, [isOpen])

  const filteredTabs = availableTabs.filter((tab) => {
    if (!filterText) return true
    const searchText = filterText.toLowerCase()
    return (
      tab.title?.toLowerCase().includes(searchText) ||
      tab.url?.toLowerCase().includes(searchText)
    )
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset focus when filter changes
  useEffect(() => {
    setFocusedIndex(0)
  }, [filterText])

  const isTabSelected = (tabId?: number) =>
    tabId !== undefined && selectedTabs.some((t) => t.id === tabId)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((prev) =>
            prev < filteredTabs.length - 1 ? prev + 1 : prev,
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredTabs[focusedIndex]) {
            onToggleTab(filteredTabs[focusedIndex])
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
    },
    [isOpen, filteredTabs, focusedIndex, onToggleTab, onClose],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  useEffect(() => {
    if (listRef.current && focusedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-tab-item]')
      items[focusedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIndex])

  if (!isOpen) return null

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[calc(100vw-24px)] max-w-[400px] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
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
          <CommandList ref={listRef} className="max-h-64 overflow-auto">
            <CommandEmpty className="py-6 text-center">
              <div className="text-muted-foreground text-sm">
                {filterText
                  ? `No tabs matching "${filterText}"`
                  : 'No active tabs'}
              </div>
              <div className="mt-1 text-muted-foreground/70 text-xs">
                {filterText
                  ? 'Try a different search term'
                  : 'Open some web pages to attach them'}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredTabs.map((tab, index) => {
                const isSelected = isTabSelected(tab.id)
                const isFocused = index === focusedIndex
                return (
                  <CommandItem
                    key={tab.id}
                    data-tab-item
                    value={`${tab.id}`}
                    onSelect={() => onToggleTab(tab)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors',
                      isFocused && 'bg-accent',
                    )}
                    onMouseEnter={() => setFocusedIndex(index)}
                  >
                    <div
                      className={cn(
                        'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors',
                        isSelected
                          ? 'border-[var(--accent-orange)] bg-[var(--accent-orange)]'
                          : 'border-border bg-background',
                      )}
                    >
                      {isSelected ? (
                        <Check className="h-3 w-3 text-white" />
                      ) : null}
                    </div>
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-border bg-background">
                      {tab.favIconUrl ? (
                        <img
                          src={tab.favIconUrl}
                          alt=""
                          className="h-3.5 w-3.5"
                        />
                      ) : (
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground text-xs">
                        {tab.title}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {tab.url}
                      </div>
                    </div>
                  </CommandItem>
                )
              })}
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
