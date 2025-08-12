import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/sidepanel/lib/utils';
import { z } from 'zod';
import styles from '../styles/components/TabSelector.module.scss';
import { useTabsStore, BrowserTab } from '../store/tabsStore';

// TabSelector component props schema
export const TabSelectorPropsSchema = z.object({
  isOpen: z.boolean(),  // Whether the selector is open
  onClose: z.function(),  // Callback when selector should close
  className: z.string().optional(),  // Additional CSS class
  filterQuery: z.string().optional(),  // Filter query for tab search
});

// TypeScript type from Zod schema
type TabSelectorComponentProps = {
  isOpen: boolean;
  onClose: () => void;
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
  const [activeIndex, setActiveIndex] = useState(0);
  
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
    setActiveIndex(0);
  }, [filteredTabs]);

  // Fetch tabs when component opens
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0); // Reset keyboard navigation
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
          setActiveIndex(prev => (prev + 1) % filteredTabs.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(prev => (prev - 1 + filteredTabs.length) % filteredTabs.length);
          break;
        case 'Enter':
          e.preventDefault();
          const activeTab = filteredTabs[activeIndex];
          if (activeTab) {
            toggleTabSelection(activeTab.id);
            onClose();
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
    if (!isOpen || filteredTabs.length === 0) return;
    
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
      if (!target.closest(`.${styles.tabDropdown}`)) {
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
      className={cn(styles.tabDropdown, styles.tabDropdownAbove, className)}
      role="dialog"
      aria-labelledby="tab-selector-heading"
    >
      <div className={styles.tabDropdownHeader}>
        <h3 id="tab-selector-heading" className={styles.tabDropdownTitle}>
          Browser Tabs ({filteredTabs.length})
        </h3>
        <button 
          className={styles.tabDropdownCloseBtn}
          onClick={onClose}
          aria-label="Close tab selector"
        >
          ×
        </button>
      </div>
      
      {/* Content */}
      <div className={styles.tabDropdownContent} ref={listRef}>
        {filteredTabs.length === 0 ? (
          <div className={styles.noTabsMessage}>
            {openTabs.length > 0 ? 'No tabs match your search' : 'No tabs available'}
          </div>
        ) : (
          <ul className={styles.tabsDropdownList} role="list">
            {filteredTabs.map((tab, index) => {
              const isSelected = isTabSelected(tab.id);
              const isCurrentTab = tab.id === currentTabId;
              const isActive = index === activeIndex;
              
              return (
                <li
                  key={tab.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(tab.id, el);
                    else itemRefs.current.delete(tab.id);
                  }}
                  className={cn(
                    styles.tabDropdownItem,
                    isSelected && styles.selected,
                    isCurrentTab && styles.currentTab,
                    isActive && styles.active
                  )}
                  onClick={() => {
                    toggleTabSelection(tab.id);
                    onClose();
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* Tab icon/favicon */}
                  <div className={styles.tabIcon}>
                    {tab.favIconUrl ? (
                      <img src={tab.favIconUrl} alt="" className={styles.tabFavicon} />
                    ) : (
                      <div className={styles.defaultIcon}></div>
                    )}
                  </div>
                  
                  {/* Tab information */}
                  <div className={styles.tabInfo}>
                    <div className={styles.tabTitle}>
                      {tab.title}
                    </div>
                    <div className={styles.tabUrl}>
                      {tab.url}
                    </div>
                  </div>
                  
                  {/* Indicators */}
                  {isCurrentTab && (
                    <span className={styles.currentTabIndicator}>Current</span>
                  )}
                  {isSelected && (
                    <span className={styles.selectedIndicator} aria-label="Selected">✓</span>
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
