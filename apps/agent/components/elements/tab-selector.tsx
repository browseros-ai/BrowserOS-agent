import { Globe } from 'lucide-react'
import type { FC, PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface TabSelectorProps {
  selectedTabs: chrome.tabs.Tab[]
  onToggleTab: (tab: chrome.tabs.Tab) => void
  side?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * @public
 */
export const TabSelector: FC<PropsWithChildren<TabSelectorProps>> = ({
  children,
  selectedTabs,
  onToggleTab,
  side = 'bottom',
}) => {
  const [open, setOpen] = useState(false)
  const [availableTabs, setAvailableTabs] = useState<chrome.tabs.Tab[]>([])

  // biome-ignore lint/correctness/useExhaustiveDependencies: needed to refresh tabs list on open
  useEffect(() => {
    ;(async () => {
      const currentWindowTabs = await chrome.tabs.query({ currentWindow: true })
      const tabs = currentWindowTabs.filter((tab) =>
        tab.url?.startsWith('http'),
      )
      setAvailableTabs(tabs)
    })()
  }, [open])

  const isTabSelected = (tabId?: number) =>
    selectedTabs.some((t) => t.id === tabId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} align="start" className="w-72 p-0">
        <Command className="[&_svg:not([class*='text-'])]:text-white">
          <CommandInput placeholder="Search tabs..." className="h-9" />
          <CommandList className="max-h-64 overflow-auto">
            <div className="my-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              Select Tabs
            </div>
            <CommandEmpty>No active tabs</CommandEmpty>
            <CommandGroup>
              {availableTabs.map((tab) => {
                const tabId = tab.id?.toString() ?? ''
                const isSelected = isTabSelected(tab.id)
                return (
                  <CommandItem
                    key={tabId}
                    value={`${tab.id} ${tab.title} ${tab.url}`}
                    onSelect={() => onToggleTab(tab)}
                    className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent"
                  >
                    <Checkbox
                      checked={isSelected}
                      className="data-[state=checked]:text-white"
                    />
                    <Label className="inline-flex cursor-pointer flex-row truncate">
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-border bg-background">
                        {tab.favIconUrl ? (
                          <img
                            src={tab.favIconUrl}
                            alt=""
                            className="h-3.5 w-3.5"
                          />
                        ) : (
                          <Globe className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="truncate font-medium text-foreground text-xs">
                          {tab.title}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {tab.url}
                        </div>
                      </div>
                    </Label>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
