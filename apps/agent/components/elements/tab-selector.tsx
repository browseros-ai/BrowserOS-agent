import type { FC, PropsWithChildren } from 'react'
import { useMemo, useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { TabListItem } from './tab-list-item'
import { useAvailableTabs } from './use-available-tabs'

interface TabSelectorProps {
  selectedTabs: chrome.tabs.Tab[]
  onToggleTab: (tab: chrome.tabs.Tab) => void
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export const TabSelector: FC<PropsWithChildren<TabSelectorProps>> = ({
  children,
  selectedTabs,
  onToggleTab,
  side = 'bottom',
}) => {
  const [open, setOpen] = useState(false)
  const [filterText, setFilterText] = useState('')
  const { tabs } = useAvailableTabs({ enabled: open, filterText })

  const selectedTabIds = useMemo(
    () => new Set(selectedTabs.map((t) => t.id)),
    [selectedTabs],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className="w-72 p-0"
        role="dialog"
        aria-label="Select tabs"
      >
        <Command
          className="[&_svg:not([class*='text-'])]:text-muted-foreground"
          shouldFilter={false}
        >
          <CommandInput
            placeholder="Search tabs..."
            className="h-9"
            value={filterText}
            onValueChange={setFilterText}
          />
          <CommandList
            className="max-h-64 overflow-auto"
            role="listbox"
            aria-label="Available tabs"
            aria-multiselectable="true"
          >
            <div className="my-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              Select Tabs
            </div>
            <CommandEmpty>No active tabs</CommandEmpty>
            <CommandGroup>
              {tabs.map((tab) => (
                <CommandItem
                  key={tab.id}
                  value={`${tab.id} ${tab.title} ${tab.url}`}
                  onSelect={() => onToggleTab(tab)}
                  className="p-0"
                >
                  <TabListItem
                    tab={tab}
                    isSelected={selectedTabIds.has(tab.id)}
                    className="p-3"
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-border/50 border-t px-3 py-2">
            <span className="text-[10px] text-muted-foreground">
              Tip: Type{' '}
              <kbd className="rounded border border-border bg-muted px-1 py-0.5">
                @
              </kbd>{' '}
              in chat to mention tabs
            </span>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
