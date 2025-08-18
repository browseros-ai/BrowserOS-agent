import React, { useState, useEffect } from 'react'
import { z } from 'zod'
import { LazyTabSelector } from './LazyTabSelector'
import { useTabsStore } from '@/sidepanel/stores/tabsStore'

// SelectTabsButton component props schema
export const SelectTabsButtonPropsSchema = z.object({
  className: z.string().optional(),  // Additional CSS class
})

// TypeScript type from Zod schema
type SelectTabsButtonProps = {
  className?: string
}

/**
 * SelectTabsButton Component
 * 
 * shows the number of selected tabs and opens the TabSelector when clicked.
 */
export function SelectTabsButton({ className }: SelectTabsButtonProps) {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const { getContextTabs } = useTabsStore()
  
  const selectedTabs = getContextTabs()
  const selectedCount = selectedTabs.length
  
  const handleOpenSelector = () => {
    setIsSelectorOpen(true)
    // Small delay to ensure DOM is ready before animation
    requestAnimationFrame(() => {
      setIsVisible(true)
    })
  }
  
  const handleCloseSelector = () => {
    setIsVisible(false)
    // Wait for leave animation to complete before hiding
    setTimeout(() => {
      setIsSelectorOpen(false)
    }, 300)
  }
  
  return (
    <>
      {/* Select Tabs Button */}
      <div className={`px-4 py-2 border-t border-border bg-background ${className || ''}`}>
        <button
          onClick={handleOpenSelector}
          className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label={`Select browser tabs (${selectedCount} selected)`}
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <span className="text-sm font-medium">
              {selectedCount === 0 ? 'Select Tabs' : `${selectedCount} Tab${selectedCount === 1 ? '' : 's'} Selected`}
            </span>
          </div>
          
          {/* Selected tabs preview */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-1">
              {selectedTabs.slice(0, 2).map((tab) => (
                <div
                  key={tab.id}
                  className="w-3 h-3 rounded-sm overflow-hidden bg-muted"
                  title={tab.title}
                >
                  {tab.favIconUrl ? (
                    <img
                      src={tab.favIconUrl}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted-foreground/20" />
                  )}
                </div>
              ))}
              {selectedCount > 2 && (
                <span className="text-xs text-muted-foreground">
                  +{selectedCount - 2}
                </span>
              )}
            </div>
          )}
        </button>
      </div>
      
      {/* Tab Selector Modal */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div 
            className={`w-full max-w-md transform transition-all duration-300 ease-out ${
              isVisible 
                ? 'translate-y-0 opacity-100 scale-100' 
                : 'translate-y-32 opacity-0 scale-95'
            }`}
          >
            <LazyTabSelector
              isOpen={isSelectorOpen}
              onClose={handleCloseSelector}
            />
          </div>
        </div>
      )}
    </>
  )
} 