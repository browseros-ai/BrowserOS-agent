import React, { useState, useRef, useEffect } from 'react'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { useTeachModeStore } from './teachmode.store'

export function TeachModeIntent() {
  const { setMode, setIntent, currentIntent } = useTeachModeStore()
  const [inputValue, setInputValue] = useState(currentIntent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleBack = () => {
    setMode('idle')
  }

  useEffect(() => {
    // Auto-focus the textarea when component mounts
    textareaRef.current?.focus()
  }, [])


  const handleStartRecording = () => {
    if (inputValue.trim()) {
      setIntent(inputValue.trim())
      setMode('recording')
      // In a real implementation, we'd start the Chrome extension recording here
      chrome.runtime.sendMessage({
        action: 'TEACH_MODE_START',
        intent: inputValue.trim()
      })
    }
  }

  const suggestions = [
    'Find and remove spam emails',
    'Download invoice PDFs',
    'Check for new job postings'
  ]

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full bg-background-alt">
      {/* Internal navigation */}
      <div className="flex items-center px-4 py-2 border-b border-border">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Cancel</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Title */}
        <h2 className="text-lg font-semibold text-foreground mb-4">
          What would you like to automate?
        </h2>

        {/* Input */}
        <div className="mb-4">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="e.g., Unsubscribe from marketing emails"
            className="w-full min-h-[100px] p-3 bg-background-alt border border-border rounded-lg
                     text-sm text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                     resize-none transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleStartRecording()
              }
            }}
          />
        </div>

        {/* Helper text */}
        <p className="text-sm text-muted-foreground mb-6">
          Describe your workflow in simple terms. Be specific about what you want Nxtscape to do.
        </p>

        {/* Start button */}
        <Button
          onClick={handleStartRecording}
          disabled={!inputValue.trim()}
          variant="outline"
          className="w-full mb-6 border-[hsl(var(--brand))] text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[hsl(var(--brand))] transition-colors"
          size="lg"
        >
          Start Recording
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>

        {/* Suggestions */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            Quick suggestions:
          </p>
          <ul className="space-y-1">
            {suggestions.map((suggestion, index) => (
              <li key={index}>
                <button
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors text-left"
                >
                  • {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}