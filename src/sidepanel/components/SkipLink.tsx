import React from 'react'

/**
 * Skip link component for keyboard navigation
 * Allows users to skip to main content
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand focus:text-white focus:rounded-md focus:outline-none"
    >
      Skip to main content
    </a>
  )
}