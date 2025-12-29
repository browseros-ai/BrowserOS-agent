import { useCombobox } from 'downshift'
import {
  ArrowRight,
  File,
  Globe,
  ImageIcon,
  Layers,
  Search,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  GlowingBorder,
  GlowingElement,
} from '@/components/elements/glowing-border'
import { TabSelector } from '@/components/elements/tab-selector'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import { Button } from '@/components/ui/button'
import { Feature } from '@/lib/browseros/capabilities'
import { useCapabilities } from '@/lib/browseros/useCapabilities'
import {
  createAITabAction,
  createBrowserOSAction,
} from '@/lib/chat-actions/types'
import { openSidePanelWithSearch } from '@/lib/messaging/sidepanel/openSidepanelWithSearch'
import { cn } from '@/lib/utils'
import type { SuggestionItem } from './lib/suggestions/types'
import {
  getSuggestionLabel,
  useSuggestions,
} from './lib/suggestions/useSuggestions'
import { NewTabBranding } from './NewTabBranding'
import { NewTabFocusGrid } from './NewTabFocusGrid'
import { SearchSuggestions } from './SearchSuggestions'
import { ShortcutsDialog } from './ShortcutsDialog'
import { TopSites } from './TopSites'

interface SelectedFile {
  name: string
  size: number
  type: string
  preview?: string
}

/**
 * @public
 */
export const NewTab = () => {
  const [inputValue, setInputValue] = useState('')
  const [mounted, setMounted] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  // const fileInputRef = useRef<HTMLInputElement>(null)
  const tabsDropdownRef = useRef<HTMLDivElement>(null)
  const [selectedTabs, setSelectedTabs] = useState<chrome.tabs.Tab[]>([])
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
  const { supports } = useCapabilities()

  const toggleTab = (tab: chrome.tabs.Tab) => {
    setSelectedTabs((prev) => {
      const isSelected = prev.some((t) => t.id === tab.id)
      if (isSelected) {
        return prev.filter((t) => t.id !== tab.id)
      }
      return [...prev, tab]
    })
  }

  const removeTab = (tabId?: number) => {
    setSelectedTabs((prev) => prev.filter((t) => t.id !== tabId))
  }

  const { sections, flatItems } = useSuggestions({
    query: inputValue,
    selectedTabs,
  })

  const {
    isOpen,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    reset,
  } = useCombobox<SuggestionItem>({
    items: flatItems,
    inputValue,
    itemToString: (item) => (item ? getSuggestionLabel(item) : ''),
    onSelectedItemChange({ selectedItem }) {
      if (selectedItem) {
        runSelectedAction(selectedItem)
      }
    },
    onStateChange: ({ type, inputValue, highlightedIndex, selectedItem }) => {
      if (type === useCombobox.stateChangeTypes.InputKeyDownEnter) {
        if (!selectedItem && !highlightedIndex && !inputValue) {
          executeDefaultAction()
        }
      }
    },
    onInputValueChange({ inputValue: newValue }) {
      setInputValue(newValue ?? '')
    },
  })

  const handleSend = () => {
    if (highlightedIndex > -1) {
      const selectedItem = flatItems[highlightedIndex]
      runSelectedAction(selectedItem)
    } else {
      executeDefaultAction()
    }
  }

  const executeDefaultAction = () => {
    const selectedItem = flatItems[0]
    runSelectedAction(selectedItem)
  }

  const runSelectedAction = (item: SuggestionItem | undefined) => {
    if (!item) return

    switch (item.type) {
      case 'search':
        window.open(
          `https://www.google.com/search?q=${encodeURIComponent(item.query)}`,
          '_self',
        )
        break
      case 'ai-tab': {
        const action = createAITabAction({
          name: item.name,
          description: item.description,
          tabs: selectedTabs,
        })
        const searchQuery = `${item.name}${item.description ? ` - ${item.description}` : ''}}`
        openSidePanelWithSearch('open', {
          query: searchQuery,
          mode: 'agent',
          action,
        })
        break
      }
      case 'browseros': {
        const action = createBrowserOSAction({
          mode: item.mode,
          message: item.message,
          tabs: selectedTabs,
        })
        openSidePanelWithSearch('open', {
          query: item.message,
          mode: item.mode,
          action,
        })
        break
      }
    }
    reset()
    setSelectedTabs([])
  }

  const isSuggestionsVisible =
    // User is typing text into the input
    (isOpen && inputValue.length) ||
    // There are sections to display
    (sections.length > 0 && inputValue.length) ||
    // User has selected some active tabs
    (isOpen && selectedTabs.length)

  useEffect(() => {
    setMounted(true)
  }, [])

  const _handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 2) // Limit to 2 files
    const fileData = files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined,
    }))
    setSelectedFiles(fileData)
  }

  useEffect(() => {
    return () => {
      selectedFiles.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview)
        }
      })
    }
  }, [selectedFiles])

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-background px-6 pt-[max(25vh,16px)]">
      {/* Subtle grid background */}
      <NewTabFocusGrid />

      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Main content */}
      <div className={'relative w-full max-w-3xl space-y-8'}>
        {/* Logo and branding */}
        <NewTabBranding />
        {/* Search bar with context */}
        <div
          className={cn(
            'relative overflow-hidden bg-border/50 p-[2px]',
            isSuggestionsVisible ||
              selectedTabs.length > 0 ||
              selectedFiles.length > 0
              ? 'bg-[var(--accent-orange)]/30 shadow-[var(--accent-orange)]/10'
              : 'bg-border/50 hover:border-border',
          )}
          style={{ borderRadius: '1.5rem' }}
        >
          {mounted && (
            <div
              className="absolute inset-0"
              style={{ borderRadius: '1.5rem' }}
            >
              <GlowingBorder duration={2000} delay={0} rx="1.5rem" ry="1.5rem">
                <GlowingElement />
              </GlowingBorder>
            </div>
          )}
          <div
            className={cn(
              'relative bg-card shadow-lg',
              isSuggestionsVisible ||
                selectedTabs.length > 0 ||
                selectedFiles.length > 0
                ? 'border-[var(--accent-orange)]/30 shadow-[var(--accent-orange)]/10'
                : 'border-border/50 hover:border-border',
            )}
            style={{ borderRadius: 'calc(1.5rem - 2px)' }}
          >
            {/* Main search input */}
            <div className="flex items-center gap-3 px-5 py-4">
              <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />

              <input
                ref={inputRef}
                type="text"
                placeholder="Ask AI or search Google..."
                className="flex-1 border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
                {...getInputProps()}
              />

              <Button
                onClick={handleSend}
                size="icon"
                className="h-10 w-10 flex-shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>

            <AnimatePresence>
              {(selectedTabs.length > 0 || selectedFiles.length > 0) && (
                <motion.div
                  className="overflow-clip px-5 pb-4"
                  transition={{ duration: 0.2 }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="styled-scrollbar flex gap-3 overflow-x-auto pb-2">
                    <AnimatePresence>
                      {selectedTabs.map((selectedTab) => {
                        if (!selectedTab) return null
                        return (
                          <motion.div
                            key={selectedTab.id}
                            className="group w-48 flex-shrink-0 overflow-clip rounded-lg border border-border bg-accent/50 p-3 transition-colors hover:bg-accent"
                            transition={{ duration: 0.2 }}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                                {selectedTab.favIconUrl ? (
                                  <img
                                    src={selectedTab.favIconUrl}
                                    alt={selectedTab.title}
                                    className="h-6 w-6"
                                  />
                                ) : (
                                  <Globe className="h-6 w-6" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 truncate font-medium text-foreground text-sm">
                                  {selectedTab.title}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  Tab
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeTab(selectedTab.id)}
                                className="cursor-pointer rounded p-1 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </motion.div>
                        )
                      })}

                      {selectedFiles.map((file, index) => (
                        <div
                          key={index.toString()}
                          className="group w-48 flex-shrink-0 rounded-lg border border-border bg-accent/50 p-3 transition-colors hover:bg-accent"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                              {file.preview ? (
                                <img
                                  src={file.preview || '/placeholder.svg'}
                                  alt={file.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : file.type.startsWith('image/') ? (
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <File className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 truncate font-medium text-foreground text-sm">
                                {file.name}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {(file.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="cursor-pointer rounded p-1 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isSuggestionsVisible && (
                <SearchSuggestions
                  getItemProps={getItemProps}
                  getMenuProps={getMenuProps}
                  highlightedIndex={highlightedIndex}
                  sections={sections}
                />
              )}
            </AnimatePresence>

            {mounted && (
              <div className="flex items-center justify-between border-border/50 border-t px-5 py-3">
                <div className="flex items-center gap-1">
                  <div className="relative" ref={tabsDropdownRef}>
                    <TabSelector
                      selectedTabs={selectedTabs}
                      onToggleTab={toggleTab}
                    >
                      <Button
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium text-sm transition-all',
                          selectedTabs.length > 0
                            ? 'bg-[var(--accent-orange)]! text-white shadow-sm'
                            : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          'data-[state=open]:bg-accent',
                        )}
                      >
                        <Layers className="h-4 w-4" />
                        <span>Tabs</span>
                      </Button>
                    </TabSelector>
                  </div>

                  {/*<button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium text-sm transition-all ${
                      selectedFiles.length > 0
                        ? 'bg-[var(--accent-orange)] text-white shadow-sm'
                        : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    <span>Files</span>
                  </button>*/}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top sites */}
        {!isSuggestionsVisible && <TopSites />}

        {/* Footer links */}
        {!isSuggestionsVisible && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <a
              href="/options.html"
              className="text-muted-foreground text-xs transition-colors hover:text-foreground"
            >
              Settings
            </a>

            <span className="text-muted-foreground">•</span>
            <Button
              variant="link"
              onClick={() => setShortcutsDialogOpen(true)}
              className="hover:no-underline! px-0! text-muted-foreground text-xs transition-colors hover:text-foreground"
            >
              Shortcuts
            </Button>

            {supports(Feature.MANAGED_MCP_SUPPORT) && (
              <>
                <span className="text-muted-foreground">•</span>
                <a
                  href="/options.html#/connect-mcp"
                  className="text-muted-foreground text-xs transition-colors hover:text-foreground"
                >
                  Connect MCP servers{' '}
                  <span className="text-[var(--accent-orange)]">(new)</span>
                </a>
              </>
            )}
            {/*<span className="text-muted-foreground">•</span>
            <a
              href="/settings"
              className="text-muted-foreground text-xs transition-colors hover:text-foreground"
            >
              Shortcuts
            </a>
            <span className="text-muted-foreground">•</span>
            <a
              href="/settings"
              className="text-muted-foreground text-xs transition-colors hover:text-foreground"
            >
              Personalize
            </a>*/}
          </div>
        )}
      </div>
      {mounted && (
        <ShortcutsDialog
          open={shortcutsDialogOpen}
          onOpenChange={setShortcutsDialogOpen}
        />
      )}
    </div>
  )
}
