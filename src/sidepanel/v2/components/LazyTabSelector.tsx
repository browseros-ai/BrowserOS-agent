import React, { lazy, Suspense } from 'react'

// Lazy load the TabSelector component
const TabSelector = lazy(() => import('./shared/TabSelector').then(module => ({
  default: module.TabSelector
})))

interface LazyTabSelectorProps {
  isOpen: boolean
  onClose: () => void
  onTabSelect?: (tabId: number) => void
}

/**
 * Lazy-loaded TabSelector wrapper
 * Improves initial load performance by deferring TabSelector bundle
 */
export function LazyTabSelector(props: LazyTabSelectorProps) {
  // Don't render at all if not open
  if (!props.isOpen) return null
  
  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center p-4 text-muted-foreground">
          {/*<LoadingPawTrail />*/}
        </div>
      }
    >
      <TabSelector {...props} />
    </Suspense>
  )
}