import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/sidepanel/lib/utils';
import { z } from 'zod';
import { useTabsStore, BrowserTab } from '@/sidepanel/stores/tabsStore';

// TabSelector component props schema
export const TabSelectorPropsSchema = z.object({
  isOpen: z.boolean(),  // Whether the selector is open
  onClose: z.function(),  // Callback when selector should close
  onTabSelect: z.function().optional(),  // Callback when a tab is selected
  className: z.string().optional(),  // Additional CSS class
  filterQuery: z.string().optional(),  // Filter query for tab search
});

// TypeScript type from Zod schema
type TabSelectorComponentProps = {
  isOpen: boolean;
  onClose: () => void;
  onTabSelect?: (tabId: number) => void;
  className?: string;
  filterQuery?: string;
}

/**
 * TabSelector Component
 * 
 * A dropdown UI component that displays a list of open browser tabs
 * and allows selecting tabs with keyboard navigation support.
 */
export const TabSelector: React.FC<TabSelectorComponentProps> = ({
  isOpen,
  onClose,
  onTabSelect,
  className,
  filterQuery = '',
}) => {
  // Get data and actions from Zustand store
  const { 
    openTabs, 
    selectedTabs, 
    currentTabId,
    isCurrentTabRemoved,
    fetchOpenTabs, 
    toggleTabSelection,
    getContextTabs 
  } = useTabsStore();

  // Local state for keyboard navigation
  const [activeIndex, setActiveIndex] = useState(-1);
  
  // Refs for DOM operations
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  // Check if a tab is selected
  const isTabSelected = (tabId: number) => {
    const contextTabs = getContextTabs();
    return contextTabs.some(tab => tab.id === tabId);
  }

  // Filter tabs based on query
  const filteredTabs = useMemo(() => {
    if (!filterQuery.trim()) {
      return openTabs;
    }
    
    const query = filterQuery.toLowerCase();
    return openTabs.filter(tab => {
      const titleMatch = tab.title.toLowerCase().includes(query);
      const urlMatch = tab.url.toLowerCase().includes(query);
      return titleMatch || urlMatch;
    });
  }, [openTabs, filterQuery]);

  // Reset active index when filtered tabs change
  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredTabs]);

  // Fetch tabs when component opens
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(-1); // Reset keyboard navigation - no default selection
      fetchOpenTabs(); // Will be throttled by store
    }
  }, [isOpen, fetchOpenTabs]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || filteredTabs.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(prev => {
            // If no tab is selected, start with the first one
            if (prev === -1) return 0;
            return (prev + 1) % filteredTabs.length;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(prev => {
            // If no tab is selected, start with the last one
            if (prev === -1) return filteredTabs.length - 1;
            return (prev - 1 + filteredTabs.length) % filteredTabs.length;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0) {
            const activeTab = filteredTabs[activeIndex];
            if (activeTab) {
              toggleTabSelection(activeTab.id);
              onTabSelect?.(activeTab.id);
              onClose();
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredTabs, activeIndex, toggleTabSelection, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!isOpen || filteredTabs.length === 0 || activeIndex < 0) return;
    
    const activeTab = filteredTabs[activeIndex];
    if (activeTab) {
      const element = itemRefs.current.get(activeTab.id);
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex, filteredTabs, isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[role="dialog"]')) {
        onClose();
      }
    };

    // Delay to avoid immediate close on open
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Don't render if closed
  if (!isOpen) {
    return null;
  }
  
  return (
    <div 
      className={cn(
        'bg-popover text-popover-foreground rounded-lg border border-border shadow-lg max-h-80 overflow-hidden',
        className,
      )}
      role="dialog"
      aria-labelledby="tab-selector-heading"
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 id="tab-selector-heading" className="text-sm font-medium">
          Browser Tabs ({filteredTabs.length})
        </h3>
        <button 
          className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none p-1"
          onClick={onClose}
          aria-label="Close tab selector"
        >
          ×
        </button>
      </div>
      
      {/* Content */}
      <div className="max-h-64 overflow-y-auto" ref={listRef}>
        {filteredTabs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {openTabs.length > 0 ? 'No tabs match your search' : 'No tabs available'}
          </div>
        ) : (
          <ul className="p-2 space-y-1" role="list">
            {filteredTabs.map((tab, index) => {
              const isSelected = isTabSelected(tab.id);
              const isCurrentTab = tab.id === currentTabId;
              const isActive = activeIndex >= 0 && index === activeIndex;
              
              return (
                <li
                  key={tab.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(tab.id, el);
                    else itemRefs.current.delete(tab.id);
                  }}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-primary/10 text-primary',
                    isCurrentTab && 'ring-1 ring-primary/20',
                    isActive && 'ring-2 ring-primary'
                  )}
                  onClick={() => {
                    toggleTabSelection(tab.id);
                    onTabSelect?.(tab.id);
                    onClose();
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* Tab icon/favicon */}
                  <div className="w-4 h-4 flex-shrink-0">
                    {tab.favIconUrl ? (
                      <img src={tab.favIconUrl} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-muted rounded-sm"></div>
                    )}
                  </div>
                  
                  {/* Tab information */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {tab.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {tab.url}
                    </div>
                  </div>
                  
                  {/* Indicators */}
                  {isCurrentTab && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Current</span>
                  )}
                  {isSelected && (
                    <span className="text-primary font-bold" aria-label="Selected">✓</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

// Re-export BrowserTab type from store
export type { BrowserTab };
