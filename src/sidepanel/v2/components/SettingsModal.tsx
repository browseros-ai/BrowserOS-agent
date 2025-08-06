import React, { useState, useEffect } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { Slider } from './ui/slider'
import { cn } from '@/sidepanel/lib/utils'
import { z } from 'zod'
import { XIcon, SunIcon, MoonIcon } from './ui/Icons'
import { useSettingsStore } from '@/sidepanel/v2/stores/settingsStore'

// Define the props schema with Zod
const SettingsModalPropsSchema = z.object({
  isOpen: z.boolean(),  // Whether the modal is open
  onClose: z.function().args().returns(z.void())  // Function to close the modal
})

// Infer the type from the schema
type SettingsModalProps = z.infer<typeof SettingsModalPropsSchema>

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { fontSize, isDarkMode, setFontSize, setDarkMode } = useSettingsStore()

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!isDarkMode)
  }

  // Close modal when clicking outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 mt-4 mb-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 id="settings-modal-title" className="text-lg font-semibold text-foreground">
            Settings
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-muted"
            aria-label="Close settings"
          >
            <XIcon />
          </Button>
        </div>

        {/* Settings content */}
        <div className="space-y-6">
          {/* Theme toggle */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Appearance</h3>
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand to-brand/80 flex items-center justify-center">
                  {isDarkMode ? <MoonIcon /> : <SunIcon />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
                </div>
              </div>
              <Button
                onClick={toggleDarkMode}
                variant="outline"
                size="sm"
                className={`h-8 px-3 rounded-lg transition-all duration-200 ${
                  isDarkMode 
                    ? 'bg-brand text-white border-brand hover:bg-brand/90' 
                    : 'bg-background border-border hover:bg-muted'
                }`}
                aria-label={`${isDarkMode ? 'Disable' : 'Enable'} dark mode`}
              >
                {isDarkMode ? 'On' : 'Off'}
              </Button>
            </div>
          </div>

          {/* Font Size */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Typography</h3>
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Font Size</p>
                  <p className="text-xs text-muted-foreground">Adjust the text size across the app</p>
                </div>
                <div className="text-sm font-mono text-muted-foreground min-w-[3rem] text-right">
                  {fontSize}px
                </div>
              </div>
              <Slider
                value={fontSize}
                min={12}
                max={24}
                step={1}
                onChange={setFontSize}
                aria-label="Font size"
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Small</span>
                <span>Large</span>
              </div>
            </div>
          </div>

          {/* More settings can be added here */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">About</h3>
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
              <p className="text-sm text-muted-foreground">
                BrowserOS Agentic Assistant v1.0.0
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-6 pt-4 border-t border-border/50">
        </div>
      </div>
    </div>
  )
} 